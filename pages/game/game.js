// pages/game/game.js
const app = getApp()

Page({
  data: {
    gameId: '',
    players: [],
    rounds: [],
    showModal: false,
    showPlayerMenu: false,
    qrcodeUrl: ''
  },

  watcher: null, // 数据库监听器

  onLoad(options) {
    console.log('=== 页面加载 onLoad ===')
    console.log('接收到的参数 options:', options)

    // 显示调试信息（用户可见）
    wx.showToast({
      title: 'onLoad触发',
      icon: 'none',
      duration: 2000
    })

    if (options.gameId) {
      const gameId = options.gameId
      console.log('获取到 gameId:', gameId)
      this.setData({ gameId: gameId })

      // 检查是否是通过分享进入的（需要加入牌局）
      // 如果 options 中有 gameId 但当前用户不在牌局中，则自动加入
      this.checkAndJoinGame(gameId)
    } else if (options.scene) {
      console.log('通过小程序码进入，scene:', options.scene)
      // 通过小程序码扫码进入
      this.joinGameByScene(options.scene)
    } else {
      console.error('⚠️ 没有收到 gameId 参数！')
      wx.showModal({
        title: '错误',
        content: '未收到游戏ID参数',
        showCancel: false
      })
    }
  },

  onShow() {
    // 每次显示时刷新数据并启动实时监听
    if (this.data.gameId) {
      this.loadGameData()
      this.startWatching()
    }
  },

  onHide() {
    // 页面隐藏时停止监听
    this.stopWatching()
  },

  onUnload() {
    // 页面卸载时停止监听
    this.stopWatching()
  },

  // 启动数据库实时监听
  startWatching() {
    // 先停止之前的监听
    this.stopWatching()

    const db = wx.cloud.database()

    // 监听游戏数据变化
    this.watcher = db.collection('games')
      .doc(this.data.gameId)
      .watch({
        onChange: (snapshot) => {
          console.log('数据库变化触发:', snapshot)

          if (snapshot.docChanges.length > 0) {
            const change = snapshot.docChanges[0]
            if (change.dataType === 'update' || change.dataType === 'init') {
              // 数据更新，刷新页面
              const doc = change.doc
              this.setData({
                players: doc.players || [],
                rounds: doc.rounds || []
              })

              // 如果是玩家列表更新，显示提示
              if (change.dataType === 'update' && doc.players) {
                wx.showToast({
                  title: '有新玩家加入',
                  icon: 'success',
                  duration: 1500
                })
              }
            }
          }
        },
        onError: (err) => {
          console.error('数据库监听错误:', err)
        }
      })
  },

  // 停止数据库监听
  stopWatching() {
    if (this.watcher) {
      this.watcher.close()
      this.watcher = null
    }
  },

  // 加载游戏数据
  loadGameData(showLoading = true) {
    // 只有手动刷新时才显示 loading
    if (showLoading) {
      wx.showLoading({ title: '加载中...' })
    }

    wx.cloud.callFunction({
      name: 'game',
      data: {
        action: 'getGameDetail',
        gameId: this.data.gameId
      },
      success: (res) => {
        if (showLoading) {
          wx.hideLoading()
        }
        if (res.result.success) {
          this.setData({
            players: res.result.players,
            rounds: res.result.rounds
          })
        } else {
          if (showLoading) {
            wx.showToast({
              title: res.result.message || '加载失败',
              icon: 'none'
            })
          }
        }
      },
      fail: (err) => {
        if (showLoading) {
          wx.hideLoading()
          wx.showToast({
            title: '加载失败',
            icon: 'none'
          })
        }
        console.error('加载游戏数据失败:', err)
      }
    })
  },

  // 检查并加入游戏（直接调用云函数，无需授权）
  checkAndJoinGame(gameId) {
    console.log('=== 自动加入游戏 ===')
    console.log('gameId:', gameId)

    wx.showLoading({ title: '正在加入...' })

    // 直接调用云函数，云函数会自动使用 openid 作为标识
    wx.cloud.callFunction({
      name: 'game',
      data: {
        action: 'autoJoin',
        gameId: gameId
      },
      success: (res) => {
        console.log('云函数返回结果:', res.result)
        wx.hideLoading()

        if (res.result.success) {
          if (res.result.joined) {
            console.log('自动加入成功！')
            wx.showModal({
              title: '✅ 加入成功',
              content: `你的ID: ${res.result.debugOpenid || '未知'}`,
              showCancel: false
            })
          } else {
            console.log('已在游戏中')
            // 显示已在游戏中的提示
            wx.showModal({
              title: '你已在游戏中',
              content: `你的ID: ${res.result.debugOpenid || '未知'}`,
              showCancel: false
            })
          }
          // 刷新数据
          this.loadGameData()
        } else {
          console.error('加入失败:', res.result.message)
          wx.showModal({
            title: '加入失败',
            content: res.result.message || '未知错误',
            showCancel: false
          })
          // 即使失败也加载数据
          this.loadGameData()
        }
      },
      fail: (err) => {
        wx.hideLoading()
        console.error('云函数调用失败:', err)
        wx.showModal({
          title: '网络错误',
          content: JSON.stringify(err),
          showCancel: false
        })
        this.loadGameData()
      }
    })
  },

  // 通过小程序码场景值加入游戏
  joinGameByScene(scene) {
    // 解码场景值
    const gameId = decodeURIComponent(scene)
    this.setData({ gameId: gameId })
    this.checkAndJoinGame(gameId)
  },

  // 显示二维码
  showQRCode() {
    if (this.data.players.length >= 4) {
      wx.showToast({
        title: '最多4名玩家',
        icon: 'none'
      })
      return
    }

    // 开发版本：使用分享功能代替小程序码
    wx.showModal({
      title: '邀请好友',
      content: '请点击右上角「···」将牌局分享给好友，好友点击即可加入',
      confirmText: '我知道了',
      success: (res) => {
        if (res.confirm) {
          wx.showShareMenu({
            withShareTicket: true,
            menus: ['shareAppMessage', 'shareTimeline']
          })
        }
      }
    })

    // 正式版本：生成小程序码（小程序发布后启用下面的代码，注释掉上面的代码）
    /*
    wx.showLoading({ title: '生成中...' })

    wx.cloud.callFunction({
      name: 'game',
      data: {
        action: 'getQRCode',
        gameId: this.data.gameId
      },
      success: (res) => {
        wx.hideLoading()
        if (res.result.success) {
          this.setData({
            qrcodeUrl: res.result.qrcodeUrl,
            showModal: true
          })
        } else {
          console.error('生成失败:', res.result.message)
          wx.showModal({
            title: '生成失败',
            content: res.result.message || '请确保小程序已发布',
            showCancel: false
          })
        }
      },
      fail: (err) => {
        wx.hideLoading()
        console.error('生成二维码失败:', err)
        wx.showModal({
          title: '生成失败',
          content: '请检查云函数权限配置',
          showCancel: false
        })
      }
    })
    */
  },

  // 隐藏二维码
  hideQRCode() {
    this.setData({ showModal: false })
  },

  // 阻止事件冒泡
  stopPropagation() {},

  // 前往计分页面
  goToScore() {
    if (this.data.players.length < 2) {
      wx.showToast({
        title: '至少需要2名玩家',
        icon: 'none'
      })
      return
    }

    wx.navigateTo({
      url: `/pages/score/score?gameId=${this.data.gameId}`
    })
  },

  // 显示删除玩家菜单
  showPlayerMenu() {
    if (this.data.players.length === 0) {
      wx.showToast({
        title: '暂无玩家',
        icon: 'none'
      })
      return
    }

    this.setData({ showPlayerMenu: true })
  },

  // 隐藏玩家菜单
  hidePlayerMenu() {
    this.setData({ showPlayerMenu: false })
  },

  // 确认删除玩家
  confirmDeletePlayer(e) {
    const openid = e.currentTarget.dataset.openid
    const player = this.data.players.find(p => p.openid === openid)

    wx.showModal({
      title: '确认删除',
      content: `确定要删除玩家「${player.nickName}」吗？`,
      confirmColor: '#ff4d4f',
      success: (res) => {
        if (res.confirm) {
          this.deletePlayer(openid)
        }
      }
    })
  },

  // 删除玩家
  deletePlayer(openid) {
    wx.showLoading({ title: '删除中...' })

    wx.cloud.callFunction({
      name: 'game',
      data: {
        action: 'removePlayer',
        gameId: this.data.gameId,
        openid: openid
      },
      success: (res) => {
        wx.hideLoading()
        this.hidePlayerMenu()

        if (res.result.success) {
          wx.showToast({
            title: '删除成功',
            icon: 'success'
          })
          this.loadGameData()
        } else {
          wx.showToast({
            title: res.result.message || '删除失败',
            icon: 'none'
          })
        }
      },
      fail: (err) => {
        wx.hideLoading()
        wx.showToast({
          title: '删除失败',
          icon: 'none'
        })
        console.error('删除玩家失败:', err)
      }
    })
  },

  // 结束牌局
  endGame() {
    if (this.data.rounds.length === 0) {
      wx.showToast({
        title: '还没有开始计分',
        icon: 'none'
      })
      return
    }

    wx.showModal({
      title: '确认结束',
      content: '确定要结束当前牌局吗？',
      confirmColor: '#ff4d4f',
      success: (res) => {
        if (res.confirm) {
          this.finishGame()
        }
      }
    })
  },

  // 完成牌局
  finishGame() {
    wx.showLoading({ title: '结算中...' })

    wx.cloud.callFunction({
      name: 'game',
      data: {
        action: 'endGame',
        gameId: this.data.gameId
      },
      success: (res) => {
        wx.hideLoading()
        if (res.result.success) {
          // 跳转到结算页面
          wx.redirectTo({
            url: `/pages/result/result?gameId=${this.data.gameId}`
          })
        } else {
          wx.showToast({
            title: res.result.message || '结束失败',
            icon: 'none'
          })
        }
      },
      fail: (err) => {
        wx.hideLoading()
        wx.showToast({
          title: '结束失败',
          icon: 'none'
        })
        console.error('结束游戏失败:', err)
      }
    })
  },

  // 返回首页
  goBack() {
    wx.navigateBack({
      delta: 1,
      fail: () => {
        wx.switchTab({
          url: '/pages/index/index'
        })
      }
    })
  },

  // 自定义分享内容
  onShareAppMessage() {
    const gameId = this.data.gameId
    console.log('=== 分享牌局 ===')
    console.log('当前 gameId:', gameId)

    if (!gameId) {
      console.error('⚠️ gameId 为空，分享可能失败！')
    }

    const sharePath = `/pages/game/game?gameId=${gameId}`
    console.log('分享路径:', sharePath)

    return {
      title: '快来加入我的牌局！',
      path: sharePath,
      imageUrl: ''
    }
  }
})
