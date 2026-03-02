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

  onLoad(options) {
    if (options.gameId) {
      this.setData({ gameId: options.gameId })
      this.loadGameData()
    } else if (options.scene) {
      // 通过小程序码扫码进入
      this.joinGameByScene(options.scene)
    }
  },

  onShow() {
    // 每次显示时刷新数据
    if (this.data.gameId) {
      this.loadGameData()
    }
  },

  // 加载游戏数据
  loadGameData() {
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
          this.setData({
            players: res.result.players,
            rounds: res.result.rounds
          })
        } else {
          wx.showToast({
            title: res.result.message || '加载失败',
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
        console.error('加载游戏数据失败:', err)
      }
    })
  },

  // 通过小程序码场景值加入游戏
  joinGameByScene(scene) {
    // 解码场景值
    const gameId = decodeURIComponent(scene)

    wx.showLoading({ title: '加入中...' })

    wx.cloud.callFunction({
      name: 'game',
      data: {
        action: 'joinGame',
        gameId: gameId,
        userInfo: app.globalData.userInfo
      },
      success: (res) => {
        wx.hideLoading()
        if (res.result.success) {
          this.setData({ gameId: gameId })
          this.loadGameData()
          wx.showToast({
            title: '加入成功',
            icon: 'success'
          })
        } else {
          wx.showToast({
            title: res.result.message || '加入失败',
            icon: 'none'
          })
        }
      },
      fail: (err) => {
        wx.hideLoading()
        wx.showToast({
          title: '加入失败',
          icon: 'none'
        })
        console.error('加入游戏失败:', err)
      }
    })
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

    wx.showLoading({ title: '生成中...' })

    // 调用云函数获取小程序码
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
          wx.showToast({
            title: '生成失败',
            icon: 'none'
          })
        }
      },
      fail: (err) => {
        wx.hideLoading()
        wx.showToast({
          title: '生成失败',
          icon: 'none'
        })
        console.error('生成二维码失败:', err)
      }
    })
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
  }
})
