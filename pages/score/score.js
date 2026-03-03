// pages/score/score.js
Page({
  data: {
    gameId: '',
    players: [],
    roundNum: 1,
    totalScore: 0
  },

  onLoad(options) {
    if (options.gameId) {
      this.setData({ gameId: options.gameId })
      this.loadPlayers()
    }
  },

  // 加载玩家列表
  loadPlayers() {
    wx.showLoading({ title: '加载中...' })

    wx.cloud.callFunction({
      name: 'game',
      data: {
        action: 'getGameDetail',
        gameId: this.data.gameId
      },
      success: (res) => {
        wx.hideLoading()
        if (res.result.success) {
          // 初始化玩家分数为0
          const players = res.result.players.map(p => ({
            ...p,
            score: 0,
            hasInput: false,
            isLast: false
          }))

          this.setData({
            players: players,
            roundNum: res.result.rounds.length + 1
          })
        } else {
          wx.showToast({
            title: '加载失败',
            icon: 'none'
          })
        }
      },
      fail: (err) => {
        wx.hideLoading()
        wx.showToast({
          title: '加载失败',
          icon: 'none'
        })
        console.error('加载玩家失败:', err)
      }
    })
  },

  // 输入分数
  onScoreInput(e) {
    const openid = e.currentTarget.dataset.openid
    const index = e.currentTarget.dataset.index
    let value = e.detail.value

    // 处理空字符串和负号
    if (value === '' || value === '-') {
      value = 0
    } else {
      // 只保留数字和负号
      value = value.replace(/[^\d-]/g, '')
      if (value === '' || value === '-') {
        value = 0
      } else {
        value = parseInt(value)
        // 限制分数范围
        if (value > 1000) value = 1000
        if (value < -1000) value = -1000
      }
    }

    // 更新当前玩家分数
    let players = this.data.players.map((p, i) => {
      if (p.openid === openid) {
        return { ...p, score: value, hasInput: true }
      }
      return p
    })

    // 判断是否需要自动计算最后一个玩家的分数
    // 规则：前 N-1 个玩家都有输入（不为0或者明确输入了0）时，自动计算最后一个
    const totalPlayers = players.length
    if (totalPlayers >= 2) {
      // 统计前 N-1 个玩家中有多少个已经输入了
      const inputCountExceptLast = players.slice(0, -1).filter(p => p.hasInput).length

      if (inputCountExceptLast === totalPlayers - 1) {
        // 前 N-1 个玩家都输入了，自动计算最后一个
        const sumExceptLast = players.slice(0, -1).reduce((sum, p) => sum + p.score, 0)
        players[totalPlayers - 1].score = -sumExceptLast
        players[totalPlayers - 1].isLast = true
        players[totalPlayers - 1].hasInput = true
      } else {
        // 还没输入完，如果最后一个玩家被标记为自动计算，现在取消
        players[totalPlayers - 1].isLast = false
      }
    }

    // 计算总和
    const totalScore = players.reduce((sum, p) => sum + p.score, 0)

    this.setData({
      players: players,
      totalScore: totalScore
    })
  },

  // 提交分数
  submitScore() {
    if (this.data.totalScore !== 0) {
      wx.showToast({
        title: '分数总和必须为0',
        icon: 'none'
      })
      return
    }

    // 确认提交
    wx.showModal({
      title: '确认提交',
      content: '确定要提交本轮分数吗？',
      success: (res) => {
        if (res.confirm) {
          this.doSubmit()
        }
      }
    })
  },

  // 执行提交
  doSubmit() {
    wx.showLoading({ title: '提交中...' })

    // 构建分数对象
    const scores = {}
    this.data.players.forEach(p => {
      scores[p.openid] = p.score
    })

    wx.cloud.callFunction({
      name: 'game',
      data: {
        action: 'addRound',
        gameId: this.data.gameId,
        scores: scores
      },
      success: (res) => {
        wx.hideLoading()
        if (res.result.success) {
          wx.showToast({
            title: '提交成功',
            icon: 'success'
          })
          setTimeout(() => {
            wx.navigateBack()
          }, 1500)
        } else {
          wx.showToast({
            title: res.result.message || '提交失败',
            icon: 'none'
          })
        }
      },
      fail: (err) => {
        wx.hideLoading()
        wx.showToast({
          title: '提交失败',
          icon: 'none'
        })
        console.error('提交分数失败:', err)
      }
    })
  },

  // 返回
  goBack() {
    wx.navigateBack()
  }
})
