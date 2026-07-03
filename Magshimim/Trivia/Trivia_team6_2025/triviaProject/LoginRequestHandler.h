#pragma once
#include "IRequestHandler.h"
#include "Responses.h"
#include "LoginManager.h"
#include "RequestHandlerFactory.h"
#include "JsonRequestPacketDeserializer.h"
#include "Requests.h"
#include "json.hpp"
class RequestHandlerFactory;
class LoginRequestHandler :public IRequestHandler
{
public:
	LoginRequestHandler(LoginManager& manager,  RequestHandlerFactory& factory);
	virtual ~LoginRequestHandler() override;
	virtual bool isRequestRelevant( const struct RequestInfo& req)const override;
	virtual RequestResult handleRequest( const struct RequestInfo& req) override;
private:
	LoginManager& _manager;
	RequestHandlerFactory& _factory;
	RequestResult login(const struct RequestInfo& info);
	RequestResult signup(const struct RequestInfo& info);
};

