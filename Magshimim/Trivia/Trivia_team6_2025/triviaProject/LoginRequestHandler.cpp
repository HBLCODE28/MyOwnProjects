#include "LoginRequestHandler.h"
#include "RequestResult.h"
#include "LoggedUser.h"
#include "JsonResponsePacketSerializer.h"
using json = nlohmann::json;
LoginRequestHandler::LoginRequestHandler(LoginManager& manager, RequestHandlerFactory& factory) :IRequestHandler(), _manager(manager), _factory(factory)
{
}
LoginRequestHandler::~LoginRequestHandler()
{
}
bool LoginRequestHandler::isRequestRelevant( const struct RequestInfo& info)const 
{
	return (info.id==loginCode|| signupCode == info.id);
}
RequestResult LoginRequestHandler::handleRequest(const struct RequestInfo& info)
{
	RequestResult req;
	req.newHandler = nullptr;
	switch (info.id) 
	{
	case loginCode:
		req = this->login(info);
		break;
	case signupCode:
		req = this->signup(info);
		break;
	}
	return req;
}
struct RequestResult LoginRequestHandler::login(const struct RequestInfo& info) 
{
	struct RequestResult res;
	res.newHandler = nullptr;
	struct LoginResponse resp;

	struct LoginRequest req  =JsonRequestPacketDeserializer::deserializeLoginRequest(info.buffer);
	if (this->_manager.login(req.username, req.password)==successfulLogin)
	{
		LoggedUser user(req.username);
		resp.status = generalSuccessResponse;
		res.newHandler = this->_factory.createMenuRequestHandler(user);
	}
	else
	{
		resp.status = generalErrorResponse;
	}
	res.buffer = JsonResponsePacketSerializer::serializeLoginResponse(resp);
	return res;
}
struct RequestResult LoginRequestHandler::signup(const struct RequestInfo& info) 
{
	
	struct SignupResponse resp;
	struct RequestResult res;
	struct SignupRequest req = JsonRequestPacketDeserializer::deserializeSignUpRequest(info.buffer);
	res.newHandler = nullptr;
	if (this->_manager.signup(req.username, req.password, req.email)==successfulSignUp) 
	{
		LoggedUser user(req.username);
		res.newHandler = new MenuRequestHandler(user, this->_factory.getRoomManager(),this->_factory.getStatisticsManager(), this->_factory);
		resp.status = generalSuccessResponse;
	}
	else
	{
		resp.status = generalErrorResponse;
	}
	res.buffer = JsonResponsePacketSerializer::serializeSignUpResponse(resp);
	return res;
}