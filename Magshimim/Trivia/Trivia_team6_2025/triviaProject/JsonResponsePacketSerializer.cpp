#include <iostream> 
#include "JsonResponsePacketSerializer.h" 
#include "json.hpp"
#define LOGIN 1
#define SIGNUP 2
#define ERROR 0


using json = nlohmann::json;
//JsonResponsePacketSerializer functions
static std::vector<unsigned char>  insertIntoBuffer(std::string jsonStr, int status)
{
    std::vector<unsigned char> buffer;

    buffer.push_back(status);
    unsigned char code = buffer[0];
 
    unsigned int length = jsonStr.size();
    buffer.push_back((length >> 24) & 0xFF);
    buffer.push_back((length >> 16) & 0xFF);
    buffer.push_back((length >> 8) & 0xFF);
    buffer.push_back(length & 0xFF);

    buffer.insert(buffer.end(), jsonStr.begin(), jsonStr.end());

    return buffer;
}

//The serializeLoginResponse function should be supported to receive a LoginResponse
std::vector<unsigned char> JsonResponsePacketSerializer::serializeLoginResponse(const LoginResponse& response)
{
    json j;
    j["status"] = response.status;
    std::string jsonStr = j.dump();

    return insertIntoBuffer(jsonStr, loginCode);
    
}

//The serializeSignUpResponse function should be supported to receive a SignupResponse
std::vector<unsigned char> JsonResponsePacketSerializer::serializeSignUpResponse(const SignupResponse& response)
{
    json j;
    j["status"] = response.status;
    std::string jsonStr = j.dump();

    return insertIntoBuffer(jsonStr,signupCode);
}

//The serializeErrorResponse function should be supported to receive an ErrorResponse
std::vector<unsigned char> JsonResponsePacketSerializer::serializeErrorResponse(const ErrorResponse& response)
{
    json j;
    j["message"] = response.message;
    std::string jsonStr = j.dump();

    return insertIntoBuffer(jsonStr, generalErrorResponse);
}

std::vector<unsigned char> JsonResponsePacketSerializer::serializeLogoutResponse(const LogoutResponse& logoutResponse)
{
    json j;
    j["message"] = logoutResponse.status;

    return insertIntoBuffer(j.dump(), logoutCode);

}
std::vector<unsigned char> JsonResponsePacketSerializer::serializeGetPlayersInRoomResponse(const GetPlayersInRoomResponse& playersResponse)
{
    json j;
    j["playersInRoom"] = playersResponse.players;
    return insertIntoBuffer(j.dump(), playersInRoom);
}
std::vector<unsigned char> JsonResponsePacketSerializer::serializeJoinRoomResponse(const JoinRoomResponse& joinReponse) 
{
    json j;
    j["status"] = joinReponse.status;
    return insertIntoBuffer(j.dump(), joinRoom);
}
std::vector<unsigned char> JsonResponsePacketSerializer::serializeCreateRoomResponse(const CreateRoomResponse& createResponse)
{
    json j;
    j["status"] = createResponse.status;
    return insertIntoBuffer(j.dump(), createRoom);
}

std::vector<unsigned char> JsonResponsePacketSerializer::serializeHighScoreResponse(const GetHighScoreResponse& highScoreResponse)  
{
    json j;
    j["status"] = highScoreResponse.status;
    j["players"] = json::array();
    for (auto it = highScoreResponse.stats.begin(); it != highScoreResponse.stats.end(); it+=2)
    {
        json stats;
        stats["username"] = *it;
        stats["points"] = std::stoi(*(it + 1));
        j["players"].push_back(stats);
    }
    return insertIntoBuffer(j.dump(), highScore);
}
std::vector<unsigned char> JsonResponsePacketSerializer::serializeGetRoomsResponse(const GetRoomsResponse& roomResponse)
{
    json serializedRooms;
    serializedRooms["status"] = roomResponse.status;
    serializedRooms["rooms"] = json::array();
    for (auto it = roomResponse.rooms.begin(); it != roomResponse.rooms.end(); it++)
    {
        
        json serializedRoom;
        serializedRoom["numberOfQuestions"] = it->numOfQuestions;
        serializedRoom["roomName"] =it->roomName;
        serializedRoom["roomNumber"] =it->roomNumber;
        serializedRoom["isActive"] = it->isActive;
        serializedRoom["maxUsers"] = it->maxPlayers;
        serializedRoom["users"] = it->users; // array of users
        serializedRoom["answerTimeout"] = it->averageTimeForAQuestion;
        serializedRooms["rooms"].push_back(serializedRoom);
    }

    return insertIntoBuffer(serializedRooms.dump(), getRooms);
}

std::vector<unsigned char> JsonResponsePacketSerializer::serializeCloseRoomResponse(const struct CloseRoomResponse& resp) 
{
    json j;
    j["status"] = resp.status;

    return insertIntoBuffer(j.dump(), closeRoomResponse);
}

std::vector<unsigned char> JsonResponsePacketSerializer::serializeStartGameResponse(const struct StartGameResponse& resp)
{
    json j;
    j["status"] = resp.status;
    return insertIntoBuffer(j.dump(), startGameResponse);
}

std::vector<unsigned char> JsonResponsePacketSerializer::serializeGetRoomStateResponse(const struct GetRoomStateResponse& resp) 
{
    json j;
    j["status"] = resp.status;
    j["players"] = resp.players;
    j["gameBegun"] = resp.hasGameBegun;
    j["questionCount"] = resp.questionCount;
    j["questionTimeout"] = resp.answerTimeOut;
    return insertIntoBuffer(j.dump(), getRoomStateResponse);
}
std::vector<unsigned char> JsonResponsePacketSerializer::serializeLeaveRoomResponse(const struct LeaveRoomResponse& resp) 
{
    json j;
    j["status"] = resp.status;
    return insertIntoBuffer(j.dump(), leaveRoomResponse);
}
std::vector <unsigned char> JsonResponsePacketSerializer::serializeLeaveGameResponse(const struct LeaveGameResponse& resp)
{
    json j;
    j["status"] = resp.status;
    return insertIntoBuffer(j.dump(), leaveGameResponseCode);
}
std::vector<unsigned char> JsonResponsePacketSerializer::serializeGetQuestionResponse(const struct GetQuestionResponse& resp) 
{
    json j;
    j["status"] = resp.status;
    j["question"] = resp.question;
    j["answers"] = resp.answers;
    return insertIntoBuffer(j.dump(), getQuestionResponseCode);
}
std::vector<unsigned char> JsonResponsePacketSerializer::serializeSubmitAnswerResponse(const struct SubmitAnswerResponse& resp)
{
    json j;
    j["status"] = resp.status;
    j["correctAnswerId"] = resp.correctAnswerId;
    return insertIntoBuffer(j.dump(), submitAnswerResponseCode);
}
std::vector<unsigned char> JsonResponsePacketSerializer::serializeGetGameResultsResponse(const struct GetGameResultsResponse& resp)
{
    json j;
    j["status"] = resp.status;
    j["results"] = json::array();
    for (auto it = resp.results.begin(); it != resp.results.end(); it++) 
    {
        json player;
        player["username"] = it->username;
        player["correctAnswersCount"] = it->correctAnswerCount;
        player["averageAnswerTime"] = it->averageAnswerTime;
        player["wrongAnswerCount"] = it->wrongAnswerCount;
        j["results"].push_back(player);
    }
    return insertIntoBuffer(j.dump(), getGameResultsResponseCode);
}

std::vector<unsigned char> JsonResponsePacketSerializer::serializeGetPersonalStatsResponse(const struct GetPersonalStatsResponse& resp)     
{
    json j;
    j["status"] = resp.status;
    j["totalNumberOfQuestions"] = std::stoi(resp.stats[0]);
    j["numberOfCorrectAnswers"] = std::stoi(resp.stats[1]);
    j["averageAnswerTime"] = std::stoi(resp.stats[2]);
    j["numberOfGamesPlayed"] = std::stoi(resp.stats[3]);
    return insertIntoBuffer(j.dump(), personalStats);
}