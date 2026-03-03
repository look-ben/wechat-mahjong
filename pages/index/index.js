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
    winRate: 0,
    hasCurrentGame: false,
    monthlyStats: []
  },

  onLoad() {
    this.getUserInfo()
    this.checkCurrentGame()
    this.loadStats()
    this.loadMonthlyStats()
  },

  onShow() {
    // 每次显示页面时检查当前牌局状态
    this.checkCurrentGame()
    this.loadStats()
    this.loadMonthlyStats()
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
          const winCount = res.result.winCount || 0
          const loseCount = res.result.loseCount || 0
          const totalGames = winCount + loseCount
          const winRate = totalGames > 0 ? Math.round((winCount / totalGames) * 100) : 0

          this.setData({
            winCount,
            loseCount,
            winRate
          })
        }
      }
    })
  },

  // 加载月度统计数据
  loadMonthlyStats() {
    wx.cloud.callFunction({
      name: 'game',
      data: {
        action: 'getMonthlyStats'
      },
      success: (res) => {
        if (res.result && res.result.stats) {
          // 处理统计数据
          const stats = res.result.stats.map(item => {
            const totalGames = item.totalGames || 0
            const wins = item.wins || 0
            const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0
            const avgScore = totalGames > 0 ? Math.round(item.totalScore / totalGames) : 0

            return {
              month: item.month,
              totalGames,
              wins,
              winRate,
              totalScore: item.totalScore || 0,
              avgScore,
              maxScore: item.maxScore || 0
            }
          })

          this.setData({
            monthlyStats: stats
          })
        }
      },
      fail: (err) => {
        console.error('加载月度统计失败:', err)
        // 如果云函数失败，使用模拟数据（开发时使用）
        this.loadMockStats()
      }
    })
  },

  // 模拟数据（用于开发测试）
  loadMockStats() {
    const mockStats = [
      {
        month: '2026-03',
        totalGames: 15,
        wins: 8,
        winRate: 53,
        totalScore: 1250,
        avgScore: 83,
        maxScore: 320
      },
      {
        month: '2026-02',
        totalGames: 22,
        wins: 12,
        winRate: 55,
        totalScore: 1680,
        avgScore: 76,
        maxScore: 280
      },
      {
        month: '2026-01',
        totalGames: 18,
        wins: 7,
        winRate: 39,
        totalScore: -450,
        avgScore: -25,
        maxScore: 150
      }
    ]

    this.setData({
      monthlyStats: mockStats
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
  }
})
