#pragma once
#pragma comment (lib,"ws2_32.lib")
#include <iostream>
#include <bitset>
#include <set>
#include <string>
#include <mutex>
#include <tuple>
#include <thread>

#include <condition_variable>
#include <fstream>
#include <WinSock2.h>
#include <windows.h>
#include <algorithm>
#include <chrono>
#include <sstream>
#include <map>
#include "IRequestHandler.h"
#include "LoginRequestHandler.h"
#include "WSAInitializer.h"
#include "Helper.h"
#include "Communicator.h"
#include "IDatabase.h"
#include "RequestHandlerFactory.h"
class Server 
{
private:
	WSAInitializer _ini;
	Communicator _communicator;
	IDatabase* _db;
public:
	Server(IDatabase* _db,RequestHandlerFactory& fact);
	~Server();
	void serve();
};