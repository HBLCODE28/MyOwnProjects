IP = "cyber.glitter.org.il"
PORT = 1336
LEN = 1050
def send_message_to_server(sock_et_et, message):
    """
    לעשות ההערה פה
    """
    sock_et_et.sendall(message.encode())
    server_msg = sock_et_et.recv(LEN)
    return server_msg.decode()