// pages/index/index.js
const app = getApp()
const db = wx.cloud.database()

Page({
  data: {
    userInfo: {
      avatarUrl: '/images/default-avatar.png',
      nickName: '加载中...'
    },
    winCount: 0,
    loseCount: 0,
    hasCurrentGame: false
  },

  onLoad() {
    this.getUserInfo()
    this.checkCurrentGame()
    this.loadStats()
  },

  onShow() {
    // 每次显示页面时检查当前牌局状态
    this.checkCurrentGame()
    this.loadStats()
  },

  // 获取用户信息
  getUserInfo() {
    wx.getSetting({
      success: (res) => {
        if (res.authSetting['scope.userInfo']) {
          wx.getUserInfo({
            success: (res) => {
              this.setData({
                userInfo: res.userInfo
              })
              app.globalData.userInfo = res.userInfo
            }
          })
        } else {
          // 未授权，使用默认信息
          this.requestUserInfo()
        }
      }
    })
  },

  // 请求用户授权
  requestUserInfo() {
    wx.getUserProfile({
      desc: '用于显示用户信息和记录游戏数据',
      success: (res) => {
        this.setData({
          userInfo: res.userInfo
        })
        app.globalData.userInfo = res.userInfo
      },
      fail: () => {
        wx.showToast({
          title: '需要授权才能使用',
          icon: 'none'
        })
      }
    })
  },

  // 检查是否有进行中的牌局
  checkCurrentGame() {
    wx.cloud.callFunction({
      name: 'game',
      data: {
        action: 'getCurrentGame'
      },
      success: (res) => {
        const hasGame = res.result && res.result.gameId
        this.setData({
          hasCurrentGame: hasGame
        })
        if (hasGame) {
          app.globalData.currentGameId = res.result.gameId
        }
      }
    })
  },

  // 加载统计数据
  loadStats() {
    wx.cloud.callFunction({
      name: 'game',
      data: {
        action: 'getUserStats'
      },
      success: (res) => {
        if (res.result) {
          this.setData({
            winCount: res.result.winCount || 0,
            loseCount: res.result.loseCount || 0
          })
        }
      }
    })
  },

  // 新开牌局
  createGame() {
    // 先请求用户信息授权
    if (!app.globalData.userInfo) {
      this.requestUserInfo()
      return
    }

    wx.showLoading({
      title: '创建中...'
    })

    wx.cloud.callFunction({
      name: 'game',
      data: {
        action: 'createGame',
        userInfo: app.globalData.userInfo
      },
      success: (res) => {
        wx.hideLoading()
        if (res.result.success) {
          app.globalData.currentGameId = res.result.gameId
          wx.navigateTo({
            url: `/pages/game/game?gameId=${res.result.gameId}`
          })
        } else {
          wx.showToast({
            title: res.result.message || '创建失败',
            icon: 'none'
          })
        }
      },
      fail: (err) => {
        wx.hideLoading()
        wx.showToast({
          title: '创建失败，请重试',
          icon: 'none'
        })
        console.error('创建牌局失败:', err)
      }
    })
  },

  // 前往当前牌局
  goToCurrentGame() {
    if (!this.data.hasCurrentGame) {
      wx.showToast({
        title: '暂无进行中的牌局',
        icon: 'none'
      })
      return
    }

    wx.navigateTo({
      url: `/pages/game/game?gameId=${app.globalData.currentGameId}`
    })
  },

  // 前往战绩统计
  goToStats() {
    wx.navigateTo({
      url: '/pages/stats/stats'
    })
  }
})
