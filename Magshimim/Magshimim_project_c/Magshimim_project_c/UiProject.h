#ifndef UIPROJECT_H
#define UIPROJECT_H

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "linkedList.h"
extern FrameNode* head;

void file_menu();
int menu();
int file_exists(const char* path);
FrameNode* new_frame(FrameNode* head);
FrameNode* add_frame(FrameNode* head, FrameNode* new_node);
void frames_list(FrameNode* head);
void change_all_frames_time(FrameNode* head, unsigned int time);
void enter_time(FrameNode* head);
void enter_name(FrameNode* head);
void change_frame_time(FrameNode* head, char* name, unsigned int time);
void remove_frame(FrameNode* head);
void change_frame_loc(FrameNode** head);
void free_all(FrameNode* head);
FrameNode* load_file();
void save_file(FrameNode* head);
#endif // UIPROJECT_H
