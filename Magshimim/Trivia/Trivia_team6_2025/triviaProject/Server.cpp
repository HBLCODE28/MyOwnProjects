#include "Server.h"
#include <exception>
#include "SqliteDatabase.h"
Server::Server(IDatabase* db,RequestHandlerFactory& fact) :_communicator(db,fact)
{
	this->_db = db;
	this->_ini;
}
Server::~Server() 
{
}

void Server::serve()
{
	this->_communicator.startHandleRequests();
}
