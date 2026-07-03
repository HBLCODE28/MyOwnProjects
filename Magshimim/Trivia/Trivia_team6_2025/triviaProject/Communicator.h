#pragma once
#include <shared_mutex>
#include <map>
#include <iostream>
#include <thread>
#include <ctime>
#include "IDatabase.h"
#include "Responses.h"
#include "JsonResponsePacketSerializer.h"
#include "helper.h"
#include "Windows.h"
#include "IRequestHandler.h"
#include "LoginRequestHandler.h"
#include "Requests.h"
#include "RequestHandlerFactory.h"
#define MAX_MESSAGE_SIZE 4096
#define SERVER_PORT 8826
#define SERVER_IP "127.0.0.1"

#define _CRT_SECURE_NO_WARNINGS

class Communicator
{
public: 
	Communicator(IDatabase* db,RequestHandlerFactory& factory);
	~Communicator();
	void startHandleRequests();
private:

	void bindAndListen();
	void handleNewClient();
	void _serverClientCommunication(SOCKET clientSocket);
	std::map<SOCKET, IRequestHandler*> m_clients;
	
	SOCKET m_serverSocket;
	std::shared_mutex _clientMutex;
	RequestHandlerFactory& _factory;

	IDatabase* _db;
};

