FROM 418596590147.dkr.ecr.us-east-1.amazonaws.com/mockmate-ai-backend-base-image:latest

WORKDIR /usr/src/app

COPY package*.json ./

RUN  npm ci --omit=dev

COPY . .

EXPOSE  5001

CMD ["node","server.js"]
