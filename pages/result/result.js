// pages/result/result.js
Page({
  data: {
    gameId: '',
    rankings: [],
    totalRounds: 0,
    startTime: '',
    endTime: '',
    duration: '',
    rankColors: ['#FFD700', '#C0C0C0', '#CD7F32'] // 金银铜
  },

  onLoad(options) {
    if (options.gameId) {
      this.setData({ gameId: options.gameId })
      this.loadResult()
    }
  },

  // 加载结果数据
  loadResult() {
    wx.showLoading({ title: '加载中...' })

    wx.cloud.callFunction({
      name: 'game',
      data: {
        action: 'getGameResult',
        gameId: this.data.gameId
      },
      success: (res) => {
        wx.hideLoading()
        if (res.result.success) {
          const data = res.result.data

          // 计算游戏时长
          const duration = this.calculateDuration(data.startTime, data.endTime)

          this.setData({
            rankings: data.rankings,
            totalRounds: data.totalRounds,
            startTime: this.formatTime(data.startTime),
            endTime: this.formatTime(data.endTime),
            duration: duration
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
        console.error('加载结果失败:', err)
      }
    })
  },

  // 格式化时间
  formatTime(timestamp) {
    const date = new Date(timestamp)
    const month = date.getMonth() + 1
    const day = date.getDate()
    const hour = date.getHours().toString().padStart(2, '0')
    const minute = date.getMinutes().toString().padStart(2, '0')
    return `${month}月${day}日 ${hour}:${minute}`
  },

  // 计算时长
  calculateDuration(start, end) {
    const diff = end - start
    const hours = Math.floor(diff / 3600000)
    const minutes = Math.floor((diff % 3600000) / 60000)

    if (hours > 0) {
      return `${hours}小时${minutes}分钟`
    } else {
      return `${minutes}分钟`
    }
  },

  // 分享战绩
  shareResult() {
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    })

    wx.showToast({
      title: '点击右上角分享',
      icon: 'none'
    })
  },

  // 自定义分享内容
  onShareAppMessage() {
    const winner = this.data.rankings[0]
    return {
      title: `${winner.nickName} 赢得了牌局！`,
      path: `/pages/result/result?gameId=${this.data.gameId}`,
      imageUrl: '/images/share-bg.png'
    }
  },

  // 返回首页
  goHome() {
    wx.reLaunch({
      url: '/pages/index/index'
    })
  }
})
