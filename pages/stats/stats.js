// pages/stats/stats.js
Page({
  data: {
    currentMonth: '',
    monthDisplay: '',
    monthStats: {
      gamesCount: 0,
      totalScore: 0,
      winRate: 0
    },
    games: []
  },

  onLoad() {
    // 初始化为当前月份
    const now = new Date()
    const year = now.getFullYear()
    const month = (now.getMonth() + 1).toString().padStart(2, '0')
    const currentMonth = `${year}-${month}`

    this.setData({
      currentMonth: currentMonth,
      monthDisplay: `${year}年${month}月`
    })

    this.loadMonthStats()
  },

  // 月份改变
  onMonthChange(e) {
    const month = e.detail.value
    const [year, m] = month.split('-')
    this.setData({
      currentMonth: month,
      monthDisplay: `${year}年${m}月`
    })
    this.loadMonthStats()
  },

  // 上一月
  prevMonth() {
    const [year, month] = this.data.currentMonth.split('-')
    let y = parseInt(year)
    let m = parseInt(month)

    m--
    if (m === 0) {
      m = 12
      y--
    }

    const newMonth = `${y}-${m.toString().padStart(2, '0')}`
    this.setData({
      currentMonth: newMonth,
      monthDisplay: `${y}年${m}月`
    })
    this.loadMonthStats()
  },

  // 下一月
  nextMonth() {
    const [year, month] = this.data.currentMonth.split('-')
    let y = parseInt(year)
    let m = parseInt(month)

    m++
    if (m === 13) {
      m = 1
      y++
    }

    const newMonth = `${y}-${m.toString().padStart(2, '0')}`
    this.setData({
      currentMonth: newMonth,
      monthDisplay: `${y}年${m}月`
    })
    this.loadMonthStats()
  },

  // 加载月度统计
  loadMonthStats() {
    wx.showLoading({ title: '加载中...' })

    wx.cloud.callFunction({
      name: 'game',
      data: {
        action: 'getMonthStats',
        month: this.data.currentMonth
      },
      success: (res) => {
        wx.hideLoading()
        if (res.result.success) {
          this.setData({
            monthStats: res.result.stats,
            games: res.result.games
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
        console.error('加载统计失败:', err)
      }
    })
  },

  // 分享战绩
  shareStats() {
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    })

    wx.showToast({
      title: '点击右上角分享',
      icon: 'none'
    })
  },

  // 自定义分享
  onShareAppMessage() {
    const stats = this.data.monthStats
    return {
      title: `我在${this.data.monthDisplay}参与了${stats.gamesCount}场牌局，总得分${stats.totalScore > 0 ? '+' : ''}${stats.totalScore}分！`,
      path: '/pages/index/index'
    }
  },

  // 返回首页
  goBack() {
    wx.navigateBack({
      fail: () => {
        wx.switchTab({
          url: '/pages/index/index'
        })
      }
    })
  }
})
