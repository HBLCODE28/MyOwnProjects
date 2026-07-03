#define CV_IGNORE_DEBUG_BUILD_GUARD
#include <opencv2/imgcodecs/imgcodecs_c.h>
#include <stddef.h>
#include <stdio.h>
#include <stdbool.h>
#include "view.h"
#include "UiProject.h"
#include "linkedList.h"
#include <opencv2/core/core_c.h>
#include <opencv2/highgui/highgui_c.h>
#define STR_LEN 50
#define EXIT 0
#define ADD_NEW_FRAME 1
#define REMOVE_FRAME 2
#define CHANGE_PLACE 3
#define CHANGE_FRAME_TIME 4
#define CHANGE_FRAMES_TIME 5
#define FRAME_LIST 6
#define PLAY 7
#define SAVE 8
#define BACK 9


#define STR_LEN 50

FrameNode* head = NULL;

int main() {
    FrameNode* new_node = NULL;
    int choice;

    file_menu(); 

    do {
        choice = menu();
        system("cls"); 
        switch (choice) {
        case ADD_NEW_FRAME: 
            new_node = new_frame(head);
            head = add_frame(head, new_node);
            break;
        case REMOVE_FRAME:
            remove_frame(head);
            break;
        case CHANGE_PLACE:
            change_frame_loc(&head);
            break;
        case CHANGE_FRAME_TIME:
            enter_name(head);
            break;
        case CHANGE_FRAMES_TIME:
            enter_time(head);
            break;
        case FRAME_LIST:
            frames_list(head);
            break;
        case PLAY:
            play(head);
            break;
        case SAVE:
            save_file(head);
            break;
        case BACK:
            system("cls");
            file_menu();
            break;
        case EXIT:
            free_all(head);
            exit(0);
        default:
            printf("Invalid choice\n");
        }
    } while (1);

    return 0;
}