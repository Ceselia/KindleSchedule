// 全局配置
module.exports = {
  // 服务监听端口
  port: 3000,

  // 前端轮询间隔（秒），Kindle 端每隔该时间拉取一次最新日程
  pollInterval: 30,

  // SQLite 单文件数据库路径
  dbFile: __dirname + '/schedules.db',

  // 微信公众号配置
  wechat: {
    // 与微信公众号后台「服务器配置」中填写的 Token 保持一致
    token: 'kindle_dashboard_token'
  }
};
