import requests








def main():
    # Base URLs and Headers
    url = 'http://cyber.glitter.org.il'
    headers_common = {
    'Accept-Encoding': 'gzip, deflate',
    'Accept-Language': 'en-US,en;q=0.9,he;q=0.8,zh-CN;q=0.7,zh;q=0.6,ga;q=0.5,yi;q=0.4,ja;q=0.3,ar;q=0.2',
    'Cache-Control': 'max-age=0',
    'Cookie': 'sparkle=25062024.e50c3a93324551ef5ec1afc7309c4f0b.1227.25062024',
    'DNT': '1',
    'Host': 'cyber.glitter.org.il',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Proxy-Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1'
}
    print("enter user name")
    name=input()
    print("enter password")
    password=input()
    response = requests.get(f'{url}/entities?searchType=SIMPLE&searchEntry={name} HTTP/1.1', headers=headers_common)
    #response = requests.get(f'{url}/entity/23', headers=headers_common)
    #in search we can find user id
    print("response-",response.text)
    print('menu\n')
    print("(1)add likes\n")
    print("choose:")
    user_input=int(input())
    #i wanted to do this in match case but i needed py version update

    if(user_input==1):
        # GET request to view likes
        data_like_view = {
        'glit_id': '57589',
        'user_id': '44584',
        'user_screen_name': 'hbl_lola',
        'id': '1030591',
        'date': '2024-06-25T13:42:55Z'

}
        response = requests.get(f'{url}/likes?glit_id=57589%20', headers=headers_common, json=data_like_view)
        print("response-",response.text)

        # POST request to add likes
        data_like_add = {
        "glit_id": 58180,
        "user_id": 44584,
        "user_screen_name": "hbl_lola",
        "id": -1
        }
        response = requests.post(f'{url}/likes', headers=headers_common, json=data_like_add)
        print("response-",response.text)
    
if __name__ == '__main__':
    main()