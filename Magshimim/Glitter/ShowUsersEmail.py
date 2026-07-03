import socket
import json
import SendMessageToServer as mod

from SendMessageToServer import send_message_to_server

def endle_data(answer):
    start = answer.find('[')
    end = answer.find(']') + 1
    users_data = answer[start:end]
    j_data = json.loads(users_data)
    print("Users Mails:\n")
    for user in j_data:
        userName = user["screen_name"]
        mail = user["mail"]
        print("User name:", userName, "-> user mail:", mail)


        


def send_message_to_server(sock_et_et, message):
    """
    לעשות ההערה פה
    """
    sock_et_et.sendall(message.encode())
    server_msg = sock_et_et.recv(LEN)
    return server_msg.decode()


def main():
    # Create a TCP/IP sock_etet
    sock_et = socket.socket(socket.AF_INET, socket.SOCK_STREAM)


    server_address = (IP, PORT)
    sock_et.connect(server_address)

    login = """100#{gli&&er}{"user_name":"hbl_28_22_1","password":"lala","enable_push_notifications":true}##"""
    answer=send_message_to_server(sock_et, login)
    login = """110#{gli&&er}1260##"""
    answer=send_message_to_server(sock_et, login)
    login = """310#{gli&&er}48077##"""
    answer=send_message_to_server(sock_et, login)
    search="""300#{gli&&er}{"search_type":"SIMPLE","search_entry":"w"}##"""
    answer=send_message_to_server(sock_et, search)    
    endle_data(answer)
    
    # Closing the sock_et
    sock_et.close()


if __name__ == "__main__":
    main()
 #user:hbl_28_22_1 pass:lala