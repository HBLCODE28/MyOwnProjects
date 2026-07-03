#pragma once

#include <vector>
#include <string>
#include <WinSock2.h>
#include "Requests.h"
#include <map>
#include <shared_mutex>

class Helper
{
public:

	static struct RequestInfo getRequestInfoFromSocket(SOCKET sc,int bytesNum);
	
	static std::vector<unsigned char> getBufferPartFromSocket(SOCKET sc, int bytesNum);
	
	static int getMessageTypeCode(SOCKET sc);
	static int getIntPartFromSocket(SOCKET sc, int bytesNum);
	static unsigned int getIntPartFromBuffer(const std::vector<unsigned char>& buffer,int offset,int length);
	
	static std::string getPaddedNumber(int num, int digits);
	static void sendData(SOCKET sc, std::string message);
	static void sendData(SOCKET sc, const std::vector<unsigned char>& data);
	static void sendData(SOCKET sc, const unsigned char* data, unsigned int size);
	static void insertNewUserSocket(SOCKET sc, std::string user);
	static void sendMessageToUsers(const std::vector<std::string>& users, const unsigned char* message, unsigned int size);
private:
	static char* getPartFromSocket(SOCKET sc, int bytesNum);
	static char* getPartFromSocket(SOCKET sc, int bytesNum, int flags);
	static std::map<std::string, SOCKET> user_to_socket;
	static std::shared_mutex userSocketMtx;
};


#ifdef _DEBUG // vs add this define in debug mode
#include <stdio.h>
// Q: why do we need traces ?
// A: traces are a nice and easy way to detect bugs without even debugging
// or to understand what happened in case we miss the bug in the first time
#define TRACE(msg, ...) printf(msg "\n", __VA_ARGS__);
// for convenient reasons we did the traces in stdout
// at general we would do this in the error stream like that
// #define TRACE(msg, ...) fprintf(stderr, msg "\n", __VA_ARGS__);

#else // we want nothing to be printed in release version
#define TRACE(msg, ...) printf(msg "\n", __VA_ARGS__);
#define TRACE(msg, ...) // do nothing
#endif