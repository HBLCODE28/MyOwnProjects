#include "GameRequestHandler.h"
GameRequestHandler::GameRequestHandler(Game& gm, LoggedUser user, GameManager& manager, RequestHandlerFactory& factory):IRequestHandler(),_gm(gm),_user(user), _gManager(manager),_factory(factory)
{
	gm.addUser(user);
}
GameRequestHandler::~GameRequestHandler() 
{
}
bool GameRequestHandler::isRequestRelevant(const struct RequestInfo& req)const 
{
	switch (req.id) 
	{
	case leaveGameResponseCode:
	case getQuestionResponseCode:
	case submitAnswerResponseCode:
	case getGameResultsResponseCode:
		return true;
		break;
	}
	return false;
}
struct RequestResult GameRequestHandler::handleRequest(const struct RequestInfo& info) 
{
	struct RequestResult res;
	switch (info.id)
	{
	case leaveGameResponseCode:
		res = this->leaveGameRequestInfo(info);
			break;
	case getQuestionResponseCode:
		res = this->getQuestion(info);
		break;
	case submitAnswerResponseCode:
		res = this->submitAnswer(info);
		break;
	case getGameResultsResponseCode:
		res= this->getGameResults(info);
		break;
	}
	return res;
}

struct RequestResult GameRequestHandler::getQuestion(const struct RequestInfo& info) 
{
	struct RequestResult res;
	res.newHandler = nullptr;
	Question qs =this->_gm.getQuestionForUser(this->_user);
	GetQuestionResponse resp;
	std::vector<std::string > answers = qs.getPossibleAnswers();
	int i = qs.getCorrectAnswerId();// answer id is always the lowest
	for (auto it = answers.begin(); it != answers.end(); it++)
	{
		resp.answers.insert({ i,*it });
		i++;
	}
	resp.question = qs.getQuestion();
	resp.status = generalSuccessResponse;
	res.buffer=JsonResponsePacketSerializer::serializeGetQuestionResponse(resp);
	return res;
}
#define CORRECT_ANSWER_ID 1
struct RequestResult GameRequestHandler::submitAnswer(const struct RequestInfo& info)
{
	struct SubmitAnswerRequest req=JsonRequestPacketDeserializer::deserializeSubmitAnswerRequest(info.buffer);
	struct SubmitAnswerResponse resp;
	this->_gm.submitAnswer(this->_user, req.answerId, info.time);
	
	resp.correctAnswerId = CORRECT_ANSWER_ID;
	
	resp.status = generalSuccessResponse;
	struct RequestResult res;
	res.buffer=JsonResponsePacketSerializer::serializeSubmitAnswerResponse(resp);
	res.newHandler = nullptr;
	return res;
}
struct RequestResult GameRequestHandler::getGameResults(const struct RequestInfo& info) 
{ 
	struct RequestResult res;
	struct GetGameResultsResponse resp;
	resp.results = this->_gm.getGameResults();
	resp.status = generalSuccessResponse;
	res.buffer =JsonResponsePacketSerializer::serializeGetGameResultsResponse(resp);
	return res;
}
struct RequestResult GameRequestHandler::leaveGameRequestInfo(const struct RequestInfo& info)
{
	struct RequestResult res;
	res.newHandler = this->_factory.createMenuRequestHandler(this->_user);
	LeaveGameResponse resp;
	resp.status = generalSuccessResponse;
	res.buffer = JsonResponsePacketSerializer::serializeLeaveGameResponse(resp);
	this->_gm.removeUser(this->_user);
	RoomManager& roomManager = this->_factory.getRoomManager();
	Room& rm =roomManager.getRoom(this->_gm.getGameId());
	rm.removeUser(this->_user.getUsername());
	return res;
}