#include "Helper.h"
#include <iostream>
#include <fstream>
#include <iomanip>
#include <sstream>
#include <vector>
#include <ctime>
#include "JsonResponsePacketSerializer.h"
std::map<std::string, SOCKET> Helper::user_to_socket;
std::shared_mutex Helper::userSocketMtx;
// recieves the type code of the message from socket (3 bytes)
// and returns the code. if no message found in the socket returns 0 (which means the client disconnected)
int Helper::getMessageTypeCode(SOCKET sc)
{
	char* s = getPartFromSocket(sc, 3);
	std::string msg(s);

	if (msg == "")
		return 0;

	int res = std::atoi(s);
	delete s;
	return  res;
}
unsigned int Helper::getIntPartFromBuffer(const std::vector<unsigned char>& buffer, int offset, int length)
{
	if (length > sizeof(int)|| length <=0) 
	{
		throw std::exception(__FUNCTION__" Invalid length");
	}
	const unsigned char* data = buffer.data();
	unsigned int value = 0;
	memcpy(&value, data + offset, length);
	return value;
}
struct RequestInfo Helper::getRequestInfoFromSocket(SOCKET sc,int bytesNum) 
{
	RequestInfo req;
	std::vector<unsigned char> buffer = Helper::getBufferPartFromSocket(sc, bytesNum);
	req.id = buffer[0];
	time(&req.time);
	req.buffer.insert(req.buffer.end(), (buffer.begin()+5), buffer.end()); // inserting to the buffer from the start of the message
	return req;
}
// recieve data from socket according byteSize
// returns the data as int
int Helper::getIntPartFromSocket(SOCKET sc, int bytesNum)
{
	char* s = getPartFromSocket(sc, bytesNum, 0);
	return atoi(s);
}

// recieve data from socket according byteSize
// returns the data as string
std::vector<unsigned char> Helper::getBufferPartFromSocket(SOCKET sc, int bytesNum)
{
	char* s = getPartFromSocket(sc, bytesNum, 0);
	int i = 0;

	std::vector <unsigned char> buffer;
	for (i=0;i<bytesNum;i++)
	{
		buffer.push_back(s[i]);
	}
	delete[] s;
	s = nullptr;
	buffer.push_back('\0');
	return buffer;
}

// return string after padding zeros if necessary
std::string Helper::getPaddedNumber(int num, int digits)
{
	std::ostringstream ostr;
	ostr << std::setw(digits) << std::setfill('0') << num;
	return ostr.str();

}

// recieve data from socket according byteSize
// this is private function
char* Helper::getPartFromSocket(SOCKET sc, int bytesNum)
{
	return getPartFromSocket(sc, bytesNum, 0);
}

char* Helper::getPartFromSocket(SOCKET sc, int bytesNum, int flags)
{
	if (bytesNum == 0)
	{
		return (char*)"";
	}

	char* data = new char[bytesNum + 1];
	int i = 0;
	for (i = 0; i < bytesNum + 1; i++) {
		data[i] = '\0';
	}
	int res = recv(sc, data, bytesNum, flags);

	if (res == INVALID_SOCKET)
	{
		std::string s = "Error while recieving from socket: ";
		s += std::to_string(sc);
		throw std::exception(s.c_str());
	}
	if (!res) 
	{
		std::string s = "no messages are available or client has closed the socket: ";
		s += std::to_string(sc);
		throw std::exception(s.c_str());
	}

	data[bytesNum] = 0;
	return data;
}

// send data to socket
// this is private function
void Helper::sendData(SOCKET sc, std::string message)
{
	const char* data = message.c_str();
	if (!strcmp(data, "\0")) {
		return;
	}
	if (send(sc, data, message.size(), 0) == INVALID_SOCKET)
	{
		throw std::exception("Error while sending message to client");
	}
}
void Helper::sendData(SOCKET sc, const std::vector<unsigned char>& data)
{
	const char* message = (char*)data.data();
	if (!strcmp(message, "\0")) {
		return;
	}
	if (send(sc, message, data.size(), 0) == INVALID_SOCKET)
	{
		throw std::exception("Error while sending message to client");
	}
}
void Helper::sendData(SOCKET sc, const unsigned char* message,unsigned int size)
{
	if (!strcmp((const char*)message, "\0")) {
		return;
	}
	if (send(sc,(const char*) message, size, 0) == INVALID_SOCKET)
	{
		throw std::exception("Error while sending message to client");
	}
}

void Helper::sendMessageToUsers(const std::vector<std::string>& users, const unsigned char* message, unsigned int size)
{
	SOCKET uSocket = 0;

	std::shared_lock<std::shared_mutex> userSockLock(userSocketMtx, std::defer_lock);
	for (auto user = users.begin(); user != users.end(); user++)
	{
		userSockLock.unlock();
		uSocket = user_to_socket.at(*user);//.this->user_to_socket[*user];
		userSockLock.unlock();
		Helper::sendData(uSocket, message, size);
	}
}
void Helper::insertNewUserSocket(SOCKET sc, std::string user) 
{
	std::lock_guard<std::shared_mutex> lock(userSocketMtx);
	user_to_socket.insert({ user,sc });
}