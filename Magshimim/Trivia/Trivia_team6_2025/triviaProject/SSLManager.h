#pragma once
#include <openssl/ssl.h>
#include <Windows.h>
#include <string>
#include <vector>
#include <iostream>

#define _CRT_SECURE_NO_WARNINGS
#pragma warning (suppress : 4996)
class SSLManager
{
private:

	SOCKET _serSock;
	int _ssl_socket;
	int _port;
	
	SSL* _ssl;
	SSL_CTX* ctx;
	BIO *web ,* out;
	const char* _ipAddr;
	std::string _hostname;


public:
	SSLManager();
	~SSLManager();

	bool initSecureConnection();
	bool connectToServer( std::string hostname,const char* ipAddr, const int port);
	bool sendRequest(const char* buff,int length);
	bool CloseConnection();

	std::vector<unsigned char> recieveResponse(const int bytes);

};

