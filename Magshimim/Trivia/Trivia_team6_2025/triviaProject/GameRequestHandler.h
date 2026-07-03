#pragma once
#include "IRequestHandler.h"
#include "Game.h"
#include "LoggedUser.h"
#include "GameManager.h"
#include "RequestHandlerFactory.h"
#include "Responses.h"
#include "JsonRequestPacketDeserializer.h"
#include "JsonResponsePacketSerializer.h"
class GameRequestHandler :public IRequestHandler
{
private:
	GameManager& _gManager;
	RequestHandlerFactory& _factory;
	LoggedUser _user;
	Game& _gm;
	struct RequestResult getQuestion(const struct RequestInfo& info);
	struct RequestResult submitAnswer(const struct RequestInfo& info);
	struct RequestResult getGameResults(const struct RequestInfo& info);
	struct RequestResult leaveGameRequestInfo(const struct RequestInfo& info);
public:
	GameRequestHandler(Game& gm, LoggedUser user, GameManager& manager, RequestHandlerFactory& factory);
	virtual ~GameRequestHandler()override;

	virtual bool isRequestRelevant(const struct RequestInfo& req)const override;
	virtual RequestResult handleRequest(const struct RequestInfo& info)override;
};


