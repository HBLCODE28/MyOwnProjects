#include "JsonRequestPacketDeserializer.h"
#include <iostream>
#define RommIdMin 1
struct LoginRequest JsonRequestPacketDeserializer::deserializeLoginRequest(const std::vector<unsigned char>& buffer)
{
	json desirializedLogin = json::parse(buffer);
	if (desirializedLogin.count("password") == 0 || desirializedLogin.count("username") == 0) 
	{
		throw std::exception(__FUNCTION__"no username or password was sent");
	}
	struct LoginRequest login;
	std::string password = nlohmann::to_string(desirializedLogin["password"]);
	std::string username = nlohmann::to_string(desirializedLogin["username"]);
	login.password = password.substr(1,password.length()-2); // removes the " from the string
	login.username = username.substr(1,username.length()-2);
	return login;
}

struct SignupRequest JsonRequestPacketDeserializer::deserializeSignUpRequest(const std::vector<unsigned char>& buffer)
{
	json deserializedSignUp = json::parse(buffer);
	if (deserializedSignUp.count("email") == 0) 
	{
		throw std::exception(__FUNCTION__" no email was sent");
	}
	LoginRequest logedIn = JsonRequestPacketDeserializer::deserializeLoginRequest(buffer); // gets the login request structure

	struct SignupRequest signup;
	signup.password = logedIn.password;
	signup.username = logedIn.username;
	std::string deserializedEmail = nlohmann::to_string(deserializedSignUp["email"]); // converts from json to string
	signup.email = deserializedEmail.substr(1,deserializedEmail.length()-2); // removing the double quotes from the string
	return signup;
}

struct GetPlayersInRoomRequest JsonRequestPacketDeserializer::deserializeGetPlayersRequest(const std::vector<unsigned char>& buffer)
{
	int roomId;
	json deserializeGetPlayersRequest = json::parse(buffer);
	if (deserializeGetPlayersRequest.count("roomId") == 0)
	{
		throw std::exception(__FUNCTION__" no roomId was sent");
	}
	GetPlayersInRoomRequest getPlayersInRoomRequest;
	std::string roomNumber = deserializeGetPlayersRequest["roomId"];
	getPlayersInRoomRequest.roomId = std::stoi(roomNumber);
	roomId = getPlayersInRoomRequest.roomId;
	if (roomId < RommIdMin )
	{
		throw std::exception(__FUNCTION__" roomId is invalid");
	}
	return getPlayersInRoomRequest;
}
struct JoinRoomRequest JsonRequestPacketDeserializer::deserializeJoinRoomRequest(const std::vector<unsigned char>& buffer)
{
	GetPlayersInRoomRequest getPlayersInRoomRequest;
	try
	{
		getPlayersInRoomRequest = deserializeGetPlayersRequest(buffer);
	}
	catch (std::exception& e)
	{
		throw std::exception(e.what());
	}
	JoinRoomRequest joinRoomRequest;
	joinRoomRequest.roomId = getPlayersInRoomRequest.roomId;

	return joinRoomRequest;

}
struct CreateRoomRequest JsonRequestPacketDeserializer::deserializeCreateRoomRequest(const std::vector<unsigned char>& buffer)
{
	json deserializeCreateRoomRequest = json::parse(buffer);
	CreateRoomRequest createRoomRequest;
	std::string roomName = deserializeCreateRoomRequest["roomName"];
	std::string maxUsers = deserializeCreateRoomRequest["maxUsers"];
	std::string questionCount = deserializeCreateRoomRequest["numberOfQuestions"];
	std::string answerTimeout = deserializeCreateRoomRequest["answerTimeout"];
	createRoomRequest.roomName = roomName;
	createRoomRequest.maxUsers = std::stoi(maxUsers);
	createRoomRequest.questionCount = std::stoi(questionCount);
	createRoomRequest.answerTimeout = std::stoi(answerTimeout);
	return createRoomRequest;
}

unsigned int JsonRequestPacketDeserializer::getGenericStatusCode(const std::vector<unsigned char>& buffer)
{
	json j = json::parse(buffer);
	unsigned int  var = j["status"];
	return j.count("status") !=0?var:-1;
}

struct SubmitAnswerRequest JsonRequestPacketDeserializer::deserializeSubmitAnswerRequest(const std::vector<unsigned char>& buffer)
{
	json j =json::parse(buffer);
	struct SubmitAnswerRequest req;
	std::string answerId = j["correctAnswerId"];
	req.answerId = std::stoi(answerId);
	return req;
}