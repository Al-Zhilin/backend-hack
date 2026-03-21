
import requests
import json

url = "http://backend-hack-05iw.onrender.com/api/chat"
data = {
    "login": "valeria_yatsuk",
    "text": "Хочу в тур по Краснодару на 2 дня, нас будет двое"
}

response = requests.post(url, json=data, stream=True)

for line in response.iter_lines(decode_unicode=True):
    if line:
        if line.startswith('data: '):
            content = line[6:]
            if content != '[DONE]':
                print(content, end='')
        else:
            print(line)