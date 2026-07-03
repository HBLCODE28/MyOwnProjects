


import socket

IP = "cyber.glitter.org.il"
PORT = 1336
LEN = 1024

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
    send_message_to_server(sock_et, login)
    login = """110#{gli&&er}1260##"""
    send_message_to_server(sock_et, login)
    login = """310#{gli&&er}44584##"""
    send_message_to_server(sock_et, login)

    msg="""900#{gli&&er}{"screen_name":"alert","avatar":"im3","description":"0","privacy":"Public","id":48077,"user_name":"hbl_28_22_1","password":"lala","gender":"Undefined","mail":"a@a.com"}##"""

    final_response = send_message_to_server(sock_et, msg)
    print(final_response)

    # Closing the sock_etet
    sock_et.close()


if __name__ == "__main__":
    main()
 #user:hbl_28_22_1 pass:lala