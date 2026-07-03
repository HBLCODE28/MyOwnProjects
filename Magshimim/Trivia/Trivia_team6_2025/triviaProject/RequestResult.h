#pragma once
#include <iostream>
#include "IRequestHandler.h"
#include "LoggedUser.h"
#include "RoomManager.h"
#include "StatisticsManager.h"
class RequestHandlerFactory;
class MenuRequestHandler : public IRequestHandler
{
	public:
		bool isRequestRelevant(const RequestInfo& request) const override;
		RequestResult handleRequest(const RequestInfo& request) override;
		MenuRequestHandler(LoggedUser user , RoomManager& rManager , StatisticsManager& sManager ,RequestHandlerFactory& factory);
		virtual ~MenuRequestHandler() override;
	private:

		RequestResult logOut(const struct RequestInfo& requestInfo);
		RequestResult getRooms(const struct RequestInfo& requestInfo);
		RequestResult getPlayersInRoom(const  struct RequestInfo& requestInfo);
		RequestResult getPersonalStats(const struct RequestInfo& requestInfo);
		RequestResult getHighScore(const struct RequestInfo& requestInfo);
		RequestResult joinRoom(const struct RequestInfo& requestInfo);
		RequestResult createRoom(const struct RequestInfo& requestInfo);
		LoggedUser _user;
		RoomManager& _r_manager;
		StatisticsManager& _statMan;
		RequestHandlerFactory& _factory;
};



class ErrorRequestHandler : public IRequestHandler
{

};
//class RequestResult 
//{
//  public:
//	std::vector<unsigned char> _buffer;
//	IRequestHandler* _nextHandler = nullptr;
//};