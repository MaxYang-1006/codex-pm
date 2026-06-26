# Codex PM 开发环境 - 使用 alpine 镜像更轻量
FROM node:20-alpine

WORKDIR /app

# 复制 package 文件
COPY package*.json ./

# 安装依赖
RUN npm install

# 复制源代码
COPY . .

# 默认命令
CMD ["npm", "run", "dev"]