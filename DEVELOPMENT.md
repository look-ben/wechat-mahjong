# 开发文档

## 项目结构

```
wechat-mahjong/
├── pages/                  # 页面目录
│   ├── index/             # 首页
│   ├── game/              # 当前牌局页面
│   ├── score/             # 计分页面
│   ├── result/            # 结算页面
│   └── stats/             # 战绩统计页面
├── cloudfunctions/        # 云函数目录
│   └── game/              # 游戏管理云函数
├── images/                # 图片资源
├── app.js                 # 小程序逻辑
├── app.json              # 小程序配置
├── app.wxss              # 全局样式
└── project.config.json   # 项目配置
```

## 核心功能实现

### 1. 新开牌局

**流程**:
1. 用户点击「新开牌局」按钮
2. 检查是否已有进行中的牌局
3. 创建新游戏记录到 `games` 集合
4. 跳转到牌局页面

**涉及文件**:
- `pages/index/index.js` - 创建逻辑
- `cloudfunctions/game/index.js` - `createGame` 函数

### 2. 扫码加入

**流程**:
1. 创建者点击「添加牌友」
2. 云函数生成小程序码（带游戏ID参数）
3. 好友扫码打开小程序
4. 解析场景值，调用 `joinGame` 加入牌局

**涉及文件**:
- `pages/game/game.js` - 生成和扫码逻辑
- `cloudfunctions/game/index.js` - `getQRCode` 和 `joinGame` 函数

**注意事项**:
- 小程序码需要在云函数中生成
- 场景值限制32个字符
- 需要在 `config.json` 中配置 openapi 权限

### 3. 计分功能

**流程**:
1. 点击「计分」跳转到计分页面
2. 输入每个玩家的分数
3. 实时计算总和，必须为0才能提交
4. 确认后创建轮次记录到 `rounds` 集合

**涉及文件**:
- `pages/score/score.js` - 计分逻辑
- `cloudfunctions/game/index.js` - `addRound` 函数

**验证规则**:
```javascript
// 分数范围检查
if (value > 1000) value = 1000
if (value < -1000) value = -1000

// 总和检查
const totalScore = players.reduce((sum, p) => sum + p.score, 0)
if (totalScore !== 0) {
  // 不允许提交
}
```

### 4. 战绩统计

**流程**:
1. 选择月份
2. 查询该月所有已结束的牌局
3. 计算总分、胜率等统计数据
4. 展示牌局列表

**涉及文件**:
- `pages/stats/stats.js` - 统计页面逻辑
- `cloudfunctions/game/index.js` - `getMonthStats` 函数

**统计指标**:
- 参与牌局数
- 总得分
- 胜率（得分>0的牌局占比）

## 数据库查询示例

### 查询用户的进行中游戏
```javascript
db.collection('games')
  .where({
    creatorOpenid: openid,
    status: 'playing'
  })
  .get()
```

### 查询某月的游戏
```javascript
db.collection('games')
  .where({
    players: _.elemMatch({ openid: openid }),
    status: 'finished',
    createTime: _.gte(startTime).and(_.lte(endTime))
  })
  .get()
```

### 查询游戏的所有轮次
```javascript
db.collection('rounds')
  .where({ gameId: gameId })
  .orderBy('roundNum', 'asc')
  .get()
```

## 云函数开发

### 本地调试
```bash
# 安装依赖
cd cloudfunctions/game
npm install

# 上传云函数
# 在微信开发者工具中右键云函数目录
# 选择「上传并部署：云端安装依赖」
```

### 查看日志
在云开发控制台 - 云函数 - 日志中查看执行日志

### 错误处理
```javascript
try {
  // 业务逻辑
  return { success: true, data: result }
} catch (err) {
  console.error('错误:', err)
  return { success: false, message: err.message }
}
```

## 样式规范

### 颜色系统
- 主色调: `#1890ff` (蓝色)
- 成功: `#52c41a` (绿色)
- 错误: `#ff4d4f` (红色)
- 背景: `#f5f5f5` (浅灰)
- 文字: `#333` (深灰)
- 次要文字: `#666`, `#999`

### 尺寸规范
- 主标题: `48rpx`
- 次标题: `36rpx`
- 正文: `32rpx`
- 小字: `28rpx`
- 说明文字: `24rpx`

### 间距规范
- 卡片内边距: `30rpx`
- 元素间距: `20rpx`
- 按钮间距: `20rpx`

## 性能优化

### 1. 数据加载
- 使用 `wx.showLoading` 显示加载状态
- 合理使用数据缓存
- 避免频繁的数据库查询

### 2. 页面优化
- 使用 `scroll-view` 处理长列表
- 图片使用 `mode="aspectFill"` 避免变形
- 合理使用 `wx:if` 和 `hidden`

### 3. 云函数优化
- 减少数据库查询次数
- 使用聚合查询代替多次查询
- 合理使用索引

## 安全注意事项

### 1. 数据校验
- 前端和后端都要校验数据
- 分数范围限制
- 零和规则校验

### 2. 权限控制
- 只有创建者可以删除玩家
- 只有创建者可以结束牌局
- 使用 openid 验证用户身份

### 3. 防止作弊
- 分数提交需要二次确认
- 记录所有操作日志
- 数据一旦提交不可修改

## 测试建议

### 功能测试
- [ ] 创建牌局
- [ ] 扫码加入
- [ ] 计分提交
- [ ] 删除玩家
- [ ] 结束牌局
- [ ] 查看战绩

### 边界测试
- [ ] 最少玩家(2人)
- [ ] 最多玩家(4人)
- [ ] 最大分数(±1000)
- [ ] 总和不为0时的提示

### 异常测试
- [ ] 网络断开
- [ ] 重复加入
- [ ] 游戏已结束时加入
- [ ] 删除创建者

## 常用命令

### 清空数据库
```javascript
// 在云开发控制台 - 数据库 - 高级操作中执行
db.collection('games').where({}).remove()
db.collection('rounds').where({}).remove()
```

### 查询统计
```javascript
// 查询总游戏数
db.collection('games').count()

// 查询进行中的游戏
db.collection('games').where({ status: 'playing' }).count()
```

## 扩展功能建议

### 可以添加的功能
1. 修改上一轮分数
2. 历史牌局详情查看
3. 玩家数据统计（与谁打最多等）
4. 自定义游戏规则
5. 排行榜功能
6. 牌局分享海报
7. 数据导出功能

### 技术改进
1. 使用云开发实时数据推送
2. 添加消息订阅通知
3. 使用云存储保存分享图片
4. 添加埋点统计

## 问题排查

### 小程序码生成失败
- 检查云函数权限配置
- 检查场景值是否超过32字符
- 查看云函数日志

### 数据加载失败
- 检查数据库权限设置
- 检查云环境是否正确
- 查看网络请求日志

### 页面跳转失败
- 检查路径是否正确
- 检查页面是否在 app.json 中注册
- 使用 `wx.navigateTo` 的层级限制

## 发布检查清单

- [ ] 修改 AppID
- [ ] 配置云环境 ID
- [ ] 创建数据库集合
- [ ] 上传云函数
- [ ] 配置数据库权限
- [ ] 测试所有功能
- [ ] 准备宣传图片
- [ ] 填写小程序信息
- [ ] 提交审核
