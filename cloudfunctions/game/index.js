// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const action = event.action

  try {
    switch (action) {
      case 'createGame':
        return await createGame(openid, event.userInfo)
      case 'getCurrentGame':
        return await getCurrentGame(openid)
      case 'getGameDetail':
        return await getGameDetail(event.gameId, openid)
      case 'joinGame':
        return await joinGame(event.gameId, openid, event.userInfo)
      case 'checkAndJoin':
        return await checkAndJoin(event.gameId, openid, event.userInfo)
      case 'autoJoin':
        return await autoJoin(event.gameId, openid, event.userInfo)
      case 'updatePlayerInfo':
        return await updatePlayerInfo(event.gameId, openid, event.userInfo)
      case 'removePlayer':
        return await removePlayer(event.gameId, event.openid)
      case 'addRound':
        return await addRound(event.gameId, event.scores, openid)
      case 'endGame':
        return await endGame(event.gameId, openid)
      case 'getGameResult':
        return await getGameResult(event.gameId)
      case 'getUserStats':
        return await getUserStats(openid)
      case 'getMonthStats':
        return await getMonthStats(openid, event.month)
      case 'getQRCode':
        return await getQRCode(event.gameId)
      case 'getMyOpenid':
        return { success: true, openid: openid }
      default:
        return { success: false, message: '未知操作' }
    }
  } catch (err) {
    console.error('云函数执行错误:', err)
    return { success: false, message: err.message }
  }
}

// 创建游戏
async function createGame(openid, userInfo) {
  // 检查是否有进行中的游戏
  const existingGame = await db.collection('games')
    .where({
      creatorOpenid: openid,
      status: 'playing'
    })
    .get()

  if (existingGame.data.length > 0) {
    return {
      success: false,
      message: '您已有进行中的牌局，请先结束后再创建新牌局'
    }
  }

  // 创建新游戏
  const now = Date.now()
  const gameData = {
    creatorOpenid: openid,
    players: [{
      openid: openid,
      nickName: userInfo.nickName,
      avatarUrl: userInfo.avatarUrl,
      totalScore: 0
    }],
    status: 'playing',
    createTime: now,
    endTime: null
  }

  const result = await db.collection('games').add({
    data: gameData
  })

  return {
    success: true,
    gameId: result._id
  }
}

// 获取当前游戏
async function getCurrentGame(openid) {
  const result = await db.collection('games')
    .where({
      creatorOpenid: openid,
      status: 'playing'
    })
    .orderBy('createTime', 'desc')
    .limit(1)
    .get()

  if (result.data.length > 0) {
    return {
      gameId: result.data[0]._id
    }
  }

  return null
}

// 获取游戏详情
async function getGameDetail(gameId, openid) {
  // 获取游戏信息
  const game = await db.collection('games').doc(gameId).get()

  if (!game.data) {
    return { success: false, message: '游戏不存在' }
  }

  // 获取轮次记录
  const rounds = await db.collection('rounds')
    .where({ gameId: gameId })
    .orderBy('roundNum', 'asc')
    .get()

  // 计算每个玩家的总分
  const players = game.data.players.map(player => {
    let totalScore = 0
    rounds.data.forEach(round => {
      totalScore += round.scores[player.openid] || 0
    })
    return {
      ...player,
      totalScore: totalScore
    }
  })

  // 格式化轮次时间
  const formattedRounds = rounds.data.map(round => ({
    ...round,
    createTime: formatTime(round.createTime)
  }))

  return {
    success: true,
    players: players,
    rounds: formattedRounds
  }
}

// 自动加入游戏（使用真实用户信息或默认信息）
async function autoJoin(gameId, openid, userInfo) {
  console.log('==================')
  console.log('autoJoin 被调用')
  console.log('gameId:', gameId)
  console.log('当前用户 openid:', openid)
  console.log('用户信息:', userInfo)
  console.log('==================')

  const game = await db.collection('games').doc(gameId).get()

  if (!game.data) {
    return { success: false, message: '游戏不存在' }
  }

  console.log('游戏中现有玩家:')
  game.data.players.forEach((p, index) => {
    console.log(`玩家${index + 1}: ${p.nickName}, openid: ${p.openid}`)
  })

  // 检查是否已在游戏中
  const alreadyJoined = game.data.players.some(p => p.openid === openid)
  console.log('是否已在游戏中:', alreadyJoined)

  if (alreadyJoined) {
    // 已在游戏中，返回成功但未加入
    console.log('返回: 已在游戏中')
    return { success: true, joined: false, message: '已在游戏中', openid: openid }
  }

  // 不在游戏中，自动加入
  if (game.data.status !== 'playing') {
    return { success: false, message: '游戏已结束，无法加入' }
  }

  if (game.data.players.length >= 4) {
    return { success: false, message: '游戏人数已满（最多4人）' }
  }

  // 确定使用的昵称和头像
  let nickName, avatarUrl

  if (userInfo && userInfo.nickName) {
    // 使用真实的微信信息
    nickName = userInfo.nickName
    avatarUrl = userInfo.avatarUrl
  } else {
    // 使用默认信息
    const playerNum = game.data.players.length + 1
    nickName = `玩家${playerNum}`
    avatarUrl = 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0'
  }

  console.log(`准备添加新玩家: ${nickName}, openid: ${openid}`)

  await db.collection('games').doc(gameId).update({
    data: {
      players: _.push({
        openid: openid,
        nickName: nickName,
        avatarUrl: avatarUrl,
        totalScore: 0
      })
    }
  })

  console.log('新玩家添加成功！')
  return { success: true, joined: true, message: '加入成功', openid: openid }
}

// 更新玩家信息
async function updatePlayerInfo(gameId, openid, userInfo) {
  if (!userInfo || !userInfo.nickName) {
    return { success: false, message: '用户信息不能为空' }
  }

  const game = await db.collection('games').doc(gameId).get()

  if (!game.data) {
    return { success: false, message: '游戏不存在' }
  }

  // 查找玩家在数组中的索引
  const playerIndex = game.data.players.findIndex(p => p.openid === openid)

  if (playerIndex === -1) {
    return { success: false, message: '你不在游戏中' }
  }

  // 更新玩家信息
  const updateKey = `players.${playerIndex}.nickName`
  const updateAvatarKey = `players.${playerIndex}.avatarUrl`

  await db.collection('games').doc(gameId).update({
    data: {
      [updateKey]: userInfo.nickName,
      [updateAvatarKey]: userInfo.avatarUrl
    }
  })

  return { success: true, message: '更新成功' }
}

// 检查并加入游戏（自动判断是否需要加入）
async function checkAndJoin(gameId, openid, userInfo) {
  const game = await db.collection('games').doc(gameId).get()

  if (!game.data) {
    return { success: false, message: '游戏不存在' }
  }

  // 检查是否已在游戏中
  const alreadyJoined = game.data.players.some(p => p.openid === openid)

  if (alreadyJoined) {
    // 已在游戏中，返回成功但未加入
    return { success: true, joined: false, message: '已在游戏中' }
  }

  // 不在游戏中，需要加入
  if (game.data.status !== 'playing') {
    return { success: false, message: '游戏已结束，无法加入' }
  }

  if (game.data.players.length >= 4) {
    return { success: false, message: '游戏人数已满（最多4人）' }
  }

  // 如果没有用户信息，返回需要授权
  if (!userInfo || !userInfo.nickName) {
    return {
      success: false,
      needAuth: true,
      message: '需要授权'
    }
  }

  // 添加玩家
  await db.collection('games').doc(gameId).update({
    data: {
      players: _.push({
        openid: openid,
        nickName: userInfo.nickName,
        avatarUrl: userInfo.avatarUrl,
        totalScore: 0
      })
    }
  })

  return { success: true, joined: true, message: '加入成功' }
}

// 加入游戏
async function joinGame(gameId, openid, userInfo) {
  const game = await db.collection('games').doc(gameId).get()

  if (!game.data) {
    return { success: false, message: '游戏不存在' }
  }

  if (game.data.status !== 'playing') {
    return { success: false, message: '游戏已结束' }
  }

  // 检查是否已加入
  const alreadyJoined = game.data.players.some(p => p.openid === openid)
  if (alreadyJoined) {
    return { success: true, message: '已在游戏中' }
  }

  // 检查人数限制
  if (game.data.players.length >= 4) {
    return { success: false, message: '游戏人数已满' }
  }

  // 添加玩家
  await db.collection('games').doc(gameId).update({
    data: {
      players: _.push({
        openid: openid,
        nickName: userInfo.nickName,
        avatarUrl: userInfo.avatarUrl,
        totalScore: 0
      })
    }
  })

  return { success: true }
}

// 删除玩家
async function removePlayer(gameId, playerOpenid) {
  const game = await db.collection('games').doc(gameId).get()

  if (!game.data) {
    return { success: false, message: '游戏不存在' }
  }

  // 不能删除创建者
  if (playerOpenid === game.data.creatorOpenid) {
    return { success: false, message: '不能删除创建者' }
  }

  // 移除玩家
  const newPlayers = game.data.players.filter(p => p.openid !== playerOpenid)

  await db.collection('games').doc(gameId).update({
    data: {
      players: newPlayers
    }
  })

  return { success: true }
}

// 添加轮次
async function addRound(gameId, scores, openid) {
  // 获取当前轮次数
  const rounds = await db.collection('rounds')
    .where({ gameId: gameId })
    .count()

  const roundNum = rounds.total + 1

  // 创建轮次记录
  await db.collection('rounds').add({
    data: {
      gameId: gameId,
      roundNum: roundNum,
      scores: scores,
      createTime: Date.now()
    }
  })

  return { success: true }
}

// 结束游戏
async function endGame(gameId, openid) {
  const game = await db.collection('games').doc(gameId).get()

  if (!game.data) {
    return { success: false, message: '游戏不存在' }
  }

  if (game.data.creatorOpenid !== openid) {
    return { success: false, message: '只有创建者可以结束游戏' }
  }

  // 更新游戏状态
  await db.collection('games').doc(gameId).update({
    data: {
      status: 'finished',
      endTime: Date.now()
    }
  })

  return { success: true }
}

// 获取游戏结果
async function getGameResult(gameId) {
  const game = await db.collection('games').doc(gameId).get()

  if (!game.data) {
    return { success: false, message: '游戏不存在' }
  }

  // 获取所有轮次
  const rounds = await db.collection('rounds')
    .where({ gameId: gameId })
    .get()

  // 计算每个玩家的总分
  const playerScores = {}
  game.data.players.forEach(player => {
    playerScores[player.openid] = {
      ...player,
      totalScore: 0
    }
  })

  rounds.data.forEach(round => {
    Object.keys(round.scores).forEach(openid => {
      if (playerScores[openid]) {
        playerScores[openid].totalScore += round.scores[openid]
      }
    })
  })

  // 排序
  const rankings = Object.values(playerScores)
    .sort((a, b) => b.totalScore - a.totalScore)
    .map((player, index) => ({
      ...player,
      rank: index + 1
    }))

  return {
    success: true,
    data: {
      rankings: rankings,
      totalRounds: rounds.data.length,
      startTime: game.data.createTime,
      endTime: game.data.endTime
    }
  }
}

// 获取用户统计
async function getUserStats(openid) {
  // 获取所有已结束的游戏
  const games = await db.collection('games')
    .where({
      players: _.elemMatch({
        openid: openid
      }),
      status: 'finished'
    })
    .get()

  let winCount = 0
  let loseCount = 0

  for (const game of games.data) {
    // 获取该游戏的所有轮次
    const rounds = await db.collection('rounds')
      .where({ gameId: game._id })
      .get()

    // 计算总分
    let myScore = 0
    rounds.data.forEach(round => {
      myScore += round.scores[openid] || 0
    })

    if (myScore > 0) {
      winCount++
    } else if (myScore < 0) {
      loseCount++
    }
  }

  return {
    winCount: winCount,
    loseCount: loseCount
  }
}

// 获取月度统计
async function getMonthStats(openid, month) {
  const [year, m] = month.split('-')
  const startTime = new Date(`${year}-${m}-01`).getTime()
  const endTime = new Date(parseInt(year), parseInt(m), 0).getTime() + 86400000 - 1

  // 获取该月的所有游戏
  const games = await db.collection('games')
    .where({
      players: _.elemMatch({
        openid: openid
      }),
      status: 'finished',
      createTime: _.gte(startTime).and(_.lte(endTime))
    })
    .orderBy('createTime', 'desc')
    .get()

  let totalScore = 0
  let winCount = 0
  const gameList = []

  for (const game of games.data) {
    // 获取轮次
    const rounds = await db.collection('rounds')
      .where({ gameId: game._id })
      .get()

    // 计算我的得分
    let myScore = 0
    rounds.data.forEach(round => {
      myScore += round.scores[openid] || 0
    })

    totalScore += myScore
    if (myScore > 0) winCount++

    gameList.push({
      _id: game._id,
      date: formatDate(game.createTime),
      myScore: myScore,
      players: game.players,
      rounds: rounds.data.length
    })
  }

  const winRate = games.data.length > 0
    ? Math.round((winCount / games.data.length) * 100)
    : 0

  return {
    success: true,
    stats: {
      gamesCount: games.data.length,
      totalScore: totalScore,
      winRate: winRate
    },
    games: gameList
  }
}

// 获取小程序码
async function getQRCode(gameId) {
  try {
    const result = await cloud.openapi.wxacode.getUnlimited({
      scene: gameId,
      page: 'pages/game/game'
    })

    // 将buffer转为base64
    const base64 = result.buffer.toString('base64')
    const qrcodeUrl = `data:image/png;base64,${base64}`

    return {
      success: true,
      qrcodeUrl: qrcodeUrl
    }
  } catch (err) {
    console.error('生成小程序码失败:', err)
    return {
      success: false,
      message: '生成失败'
    }
  }
}

// 格式化时间
function formatTime(timestamp) {
  const date = new Date(timestamp)
  const hour = date.getHours().toString().padStart(2, '0')
  const minute = date.getMinutes().toString().padStart(2, '0')
  return `${hour}:${minute}`
}

// 格式化日期
function formatDate(timestamp) {
  const date = new Date(timestamp)
  const month = date.getMonth() + 1
  const day = date.getDate()
  return `${month}月${day}日`
}
