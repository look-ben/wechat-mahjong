// pages/game/game.js
const app = getApp()

Page({
  data: {
    gameId: '',
    players: [],
    rounds: [],
    showModal: false,
    showPlayerMenu: false,
    qrcodeUrl: '',
    myOpenid: '' // 当前用户的 openid
  },

  watcher: null, // 数据库监听器

  onLoad(options) {
    console.log('=== 页面加载 onLoad ===')
    console.log('接收到的参数 options:', options)
    console.log('当前页面 gameId:', this.data.gameId)

    // 显示调试弹窗（临时 - 用于调试华为手机）
    wx.showModal({
      title: 'onLoad 触发',
      content: 'options.gameId: ' + (options.gameId || '无') + '\n当前gameId: ' + (this.data.gameId || '无'),
      showCancel: false,
      confirmText: '继续'
    })

    // 检测页面缓存问题：如果传入了新的 gameId，但与当前不同，说明页面被复用了
    if (options.gameId && this.data.gameId && options.gameId !== this.data.gameId) {
      console.log('⚠️ 检测到页面缓存问题，强制重新加载')
      console.log('新 gameId:', options.gameId, '旧 gameId:', this.data.gameId)

      // 使用 reLaunch 彻底重新加载页面（比 redirectTo 更强制）
      wx.reLaunch({
        url: `/pages/game/game?gameId=${options.gameId}`
      })
      return
    }

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
      // 不再显示错误弹窗，因为可能是从其他页面正常进入的
    }
  },

  onShow() {
    console.log('=== onShow 触发 ===')
    console.log('当前 gameId:', this.data.gameId)

    // 显示调试弹窗（临时）
    wx.showModal({
      title: 'onShow 触发',
      content: 'gameId: ' + (this.data.gameId || '无'),
      showCancel: false,
      confirmText: '继续'
    })

    // 每次显示时刷新数据并启动实时监听
    if (this.data.gameId) {
      // 使用静默刷新（不显示 loading）
      this.loadGameData(false)
      this.startWatching()

      // 如果还没有获取 openid，现在获取
      if (!this.data.myOpenid) {
        wx.cloud.callFunction({
          name: 'game',
          data: { action: 'getMyOpenid' },
          success: (res) => {
            console.log('onShow 获取 openid:', res.result.openid)
            this.setData({ myOpenid: res.result.openid })
          }
        })
      }
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

    console.log('启动数据库监听，gameId:', this.data.gameId)
    const db = wx.cloud.database()

    // 监听游戏数据变化
    this.watcher = db.collection('games')
      .doc(this.data.gameId)
      .watch({
        onChange: (snapshot) => {
          console.log('==================')
          console.log('数据库变化触发!')
          console.log('snapshot:', snapshot)
          console.log('docChanges:', snapshot.docChanges)
          console.log('==================')

          if (snapshot.docChanges.length > 0) {
            const change = snapshot.docChanges[0]
            console.log('change.dataType:', change.dataType)
            console.log('change.updatedFields:', change.updatedFields)

            if (change.dataType === 'update' || change.dataType === 'init') {
              // 数据更新，重新加载完整数据（包括 rounds）
              console.log('✅ 检测到数据变化，开始重新加载数据')
              this.loadGameData(false)

              // 如果是分数更新，显示提示
              if (change.dataType === 'update' && change.updatedFields && change.updatedFields.lastUpdateTime) {
                console.log('检测到分数更新')
                wx.showToast({
                  title: '分数已更新',
                  icon: 'success',
                  duration: 1500
                })
              }

              // 如果是玩家列表更新，显示提示
              if (change.dataType === 'update' && change.updatedFields && change.updatedFields.players) {
                console.log('检测到玩家加入')
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
          console.error('❌ 数据库监听错误:', err)
        }
      })

    console.log('数据库监听已启动')
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

  // 检查并加入游戏（先用默认信息快速加入）
  checkAndJoinGame(gameId) {
    console.log('=== 自动加入游戏 ===')
    console.log('gameId:', gameId)

    // 直接用默认信息加入，后续可以更新
    this.joinGameWithUserInfo(gameId, null)
  },

  // 使用用户信息加入游戏
  joinGameWithUserInfo(gameId, userInfo) {
    console.log('准备加入游戏, gameId:', gameId)
    wx.showLoading({ title: '正在加入...' })

    wx.cloud.callFunction({
      name: 'game',
      data: {
        action: 'autoJoin',
        gameId: gameId,
        userInfo: userInfo
      },
      success: (res) => {
        console.log('云函数调用成功，返回结果:', res)
        console.log('res.result:', res.result)
        wx.hideLoading()

        if (res.result && res.result.success) {
          // 保存当前用户的 openid
          if (res.result.openid) {
            this.setData({ myOpenid: res.result.openid })
          }

          if (res.result.joined) {
            console.log('✅ 自动加入成功！')
            wx.showToast({
              title: '✅ 加入成功',
              icon: 'success',
              duration: 2000
            })
          } else {
            console.log('已在游戏中')
            wx.showToast({
              title: '你已在游戏中',
              icon: 'none',
              duration: 2000
            })
          }
          // 刷新数据
          this.loadGameData()
          // 启动数据库监听
          this.startWatching()
        } else {
          console.error('❌ 加入失败:', res.result ? res.result.message : '未知错误')
          wx.showModal({
            title: '加入失败',
            content: (res.result ? res.result.message : '未知错误') + '\n\ngameId: ' + gameId,
            showCancel: false,
            confirmText: '我知道了'
          })
          // 即使失败也尝试加载数据
          this.loadGameData()
        }
      },
      fail: (err) => {
        console.error('❌ 云函数调用失败:', err)
        wx.hideLoading()
        wx.showModal({
          title: '网络错误',
          content: '云函数调用失败\n' + (err.errMsg || JSON.stringify(err)) + '\n\ngameId: ' + gameId,
          showCancel: false,
          confirmText: '我知道了'
        })
        // 即使失败也尝试加载数据
        this.loadGameData()
      }
    })
  },

  // 点击玩家头像
  onPlayerAvatarTap(e) {
    const openid = e.currentTarget.dataset.openid
    console.log('点击玩家头像, openid:', openid)
    console.log('我的 openid:', this.data.myOpenid)

    // 判断是否是点击自己的头像
    // 如果 myOpenid 为空，通过云函数获取
    if (!this.data.myOpenid) {
      wx.showLoading({ title: '加载中...' })
      wx.cloud.callFunction({
        name: 'game',
        data: { action: 'getMyOpenid' },
        success: (res) => {
          wx.hideLoading()
          console.log('获取到的 openid:', res.result.openid)
          const myOpenid = res.result.openid
          this.setData({ myOpenid: myOpenid })

          if (openid === myOpenid) {
            this.updateMyInfo()
          } else {
            wx.showToast({
              title: '只能更新自己的信息',
              icon: 'none'
            })
          }
        },
        fail: (err) => {
          wx.hideLoading()
          console.error('获取 openid 失败:', err)
          wx.showToast({
            title: '获取信息失败',
            icon: 'none'
          })
        }
      })
    } else {
      if (openid === this.data.myOpenid) {
        this.updateMyInfo()
      } else {
        wx.showToast({
          title: '只能更新自己的信息',
          icon: 'none',
          duration: 1500
        })
      }
    }
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

  // 更新我的信息
  updateMyInfo() {
    console.log('开始更新信息')
    wx.getUserProfile({
      desc: '用于更新您的昵称和头像',
      success: (res) => {
        console.log('获取用户信息成功:', res.userInfo)
        wx.showLoading({ title: '更新中...' })

        wx.cloud.callFunction({
          name: 'game',
          data: {
            action: 'updatePlayerInfo',
            gameId: this.data.gameId,
            userInfo: res.userInfo
          },
          success: (cloudRes) => {
            console.log('云函数返回:', cloudRes.result)
            wx.hideLoading()
            if (cloudRes.result.success) {
              wx.showToast({
                title: '更新成功',
                icon: 'success'
              })
              // 手动刷新数据以确保显示更新
              this.loadGameData()
            } else {
              wx.showModal({
                title: '更新失败',
                content: cloudRes.result.message || '未知错误',
                showCancel: false
              })
            }
          },
          fail: (err) => {
            wx.hideLoading()
            console.error('云函数调用失败:', err)
            wx.showModal({
              title: '更新失败',
              content: JSON.stringify(err),
              showCancel: false
            })
          }
        })
      },
      fail: (err) => {
        console.error('获取用户信息失败:', err)
        wx.showToast({
          title: '需要授权才能更新',
          icon: 'none'
        })
      }
    })
  },

  // 返回首页
  goBack() {
    wx.navigateBack({
      delta: 1,
      fail: () => {
        // 如果没有上一页（比如通过分享链接直接进入），使用 reLaunch 跳转到首页
        wx.reLaunch({
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
