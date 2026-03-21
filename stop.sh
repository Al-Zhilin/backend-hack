#!/bin/bash

docker stop travel-generator
docker rm travel-generator

echo "Контейнер остановлен и удалён"
