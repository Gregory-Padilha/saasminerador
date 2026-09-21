FROM mcr.microsoft.com/playwright:v1.50.0-noble

WORKDIR /app

# Install ffmpeg
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./
RUN npm install

# Copy application source
COPY . .

# Run worker daemon
CMD ["npm", "run", "start"]
