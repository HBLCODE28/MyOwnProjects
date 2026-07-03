#include "Communicator.h"
#include "LoginManager.h"
#include "RequestHandlerFactory.h"
#include "JsonRequestPacketDeserializer.h"

Communicator::Communicator(IDatabase* db,RequestHandlerFactory& factory):_factory(factory)
{
	this->_db = db;
	this->m_clients;
	this->m_serverSocket = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
	if (INVALID_SOCKET == this->m_serverSocket)
	{
		throw std::exception(__FUNCTION__ " - socket");
	}

}
Communicator::~Communicator()
{
	
	
	try 
	{ 
		closesocket(this->m_serverSocket);
	}
	catch (...) 
	{
	}
}
void Communicator::bindAndListen() {

	struct sockaddr_in sockAdd = { 0 };
	sockAdd.sin_port = htons(SERVER_PORT);
	sockAdd.sin_family = AF_INET;
	sockAdd.sin_addr.s_addr = INADDR_ANY;

	if (bind(this->m_serverSocket, (struct sockaddr*)&sockAdd, sizeof(sockAdd)) == SOCKET_ERROR)
	{
		throw std::exception(__FUNCTION__" - bind");
	}
	std::cout << "binded successfuly" << std::endl;
	if (listen(this->m_serverSocket, SOMAXCONN) == SOCKET_ERROR)
	{
		throw std::exception(__FUNCTION__ " - listen");
	}
	std::cout << "Listening on port " << SERVER_PORT << std::endl;
	std::cout << "Waiting for the client to connect" << std::endl;
}
void Communicator::handleNewClient() 
{
	SOCKET clientSocket = accept(this->m_serverSocket, NULL, NULL);
	if (INVALID_SOCKET == clientSocket)
	{
		throw std::exception(__FUNCTION__);
	}
	std::unique_lock<std::shared_mutex> clientLock(this->_clientMutex);
	this->m_clients.insert({ clientSocket,new LoginRequestHandler(this->_factory.getLoginManager(),this->_factory)});
	clientLock.unlock();
	std::cout << "Client with socket number :" << clientSocket << " has connected\n";
	
	std::thread clientThread(&Communicator::_serverClientCommunication, this, clientSocket); // adding a thread each time a client connects
	clientThread.detach(); // detaching the thread
}

/*
	responsible for the client and the server communication
	input: socket of the client
	output none
*/
void Communicator::_serverClientCommunication(SOCKET clientSocket) 
{
	SOCKET client = clientSocket;
	std::unique_lock<std::shared_mutex> readClientLock(this->_clientMutex);
	IRequestHandler* currentHandler = this->m_clients[client];
	readClientLock.unlock();
	std::vector <unsigned char> messageBuffer;
	time_t previousTime = 0;
	time_t tempTime = 0;
	struct RequestInfo infoOfRequest;
	struct RequestResult res;
	struct ErrorResponse err;
	
	try
	{
		while (true)
		{
			readClientLock.lock();
			currentHandler = this->m_clients[client];
			readClientLock.unlock();
			infoOfRequest = Helper::getRequestInfoFromSocket(client, MAX_MESSAGE_SIZE);
			
			infoOfRequest.time -=previousTime;// difference between times is the delay between requests in seconds which will help us to find the average answer time 
			// of the user
			if (0 == previousTime)
			{
				previousTime = infoOfRequest.time;
			}
			else 
			{
				previousTime += infoOfRequest.time;// saving the time before the modification
			}
			std::cout << "Client with socket number: " << client << " sent :" << infoOfRequest.buffer.data() << "\n";
			std::string trying = "{\"status\":\"0\"}"; 
			auto end = std::find(infoOfRequest.buffer.begin(), infoOfRequest.buffer.end(), '\0');
			std::string vec_as_str(infoOfRequest.buffer.begin(), end);
			if (trying == vec_as_str) {
		
				std::cout<<"Working!" << "\n";
			}
			if (currentHandler->isRequestRelevant(infoOfRequest))
			{
				res = currentHandler->handleRequest(infoOfRequest);
				if (res.newHandler != nullptr) 
				{
					delete currentHandler;					
					currentHandler = res.newHandler;
					std::lock_guard<std::shared_mutex> writeClientLock(this->_clientMutex);// unlocks when destructs
					this->m_clients[client] = currentHandler;
				}
				Helper::sendData(client,res.buffer);
			}
			else
			{
				err.message = generalErrorResponse;
				messageBuffer.clear();
				messageBuffer = JsonResponsePacketSerializer::serializeErrorResponse(err);
				Helper::sendData(client, messageBuffer);
			}
		}

	}
	catch (const std::exception& exp)
	{
		std::cout << "An error occurred with client " <<client <<": " << exp.what() << "\n";
	}
	std::cout << "Client with socket number " << client << " disconected\n";
	closesocket(client);
	std::lock_guard<std::shared_mutex> clientsLock(this->_clientMutex);
	delete this->m_clients[client];
	this->m_clients.erase(client);
}
void Communicator::startHandleRequests() 
{
	this->bindAndListen();
	while (true) 
	{
		this->handleNewClient();
	}
}