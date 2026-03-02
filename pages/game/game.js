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
      const gameId = options.gameId
      this.setData({ gameId: gameId })

      // 检查是否是通过分享进入的（需要加入牌局）
      // 如果 options 中有 gameId 但当前用户不在牌局中，则自动加入
      this.checkAndJoinGame(gameId)
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

  // 检查并加入游戏
  checkAndJoinGame(gameId) {
    // 尝试使用云函数自动获取用户信息并加入
    // 云函数可以通过 OPENID 获取基本信息
    this.doCheckAndJoin(gameId)
  },

  // 执行检查并加入
  doCheckAndJoin(gameId) {
    wx.showLoading({ title: '加载中...' })

    wx.cloud.callFunction({
      name: 'game',
      data: {
        action: 'checkAndJoin',
        gameId: gameId
      },
      success: (res) => {
        wx.hideLoading()
        if (res.result.success) {
          if (res.result.joined) {
            wx.showToast({
              title: '加入成功',
              icon: 'success'
            })
          }
          // 无论是否新加入，都刷新数据
          this.loadGameData()
        } else {
          wx.showToast({
            title: res.result.message || '操作失败',
            icon: 'none',
            duration: 3000
          })
          // 即使失败也尝试加载数据
          this.loadGameData()
        }
      },
      fail: (err) => {
        wx.hideLoading()
        console.error('检查并加入失败:', err)
        wx.showToast({
          title: '加入失败，请重试',
          icon: 'none'
        })
        // 失败时也尝试加载数据
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
    return {
      title: '快来加入我的牌局！',
      path: `/pages/game/game?gameId=${this.data.gameId}`,
      imageUrl: ''
    }
  }
})
