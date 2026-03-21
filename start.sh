#!/bin/bash

docker build -t travel-generator .
docker run -d -p 8000:8000 --env-file .env --name travel-generator travel-generator

echo "Контейнер запущен на http://localhost:8000"
