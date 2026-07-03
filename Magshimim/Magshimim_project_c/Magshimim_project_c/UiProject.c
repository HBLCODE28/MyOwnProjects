#include "UiProject.h"
#include <stdio.h>
#define _GNU_SOURCE
#include <stdio.h>
#include <stdlib.h>
#include "linkedList.h"
#include <string.h >
#include "view.h"

#define STRLEN 120

//THE MENUS
int menu() {
    int choice;

    printf("\033[1;34m");
    printf("**********************\n");
    printf("*       MENU         *\n");
    printf("**********************\n");
    printf("\033[0m");

    printf("\033[1;32m0.\033[0m Exit\n");
    printf("\033[1;32m1.\033[0m Add Frame\n");
    printf("\033[1;32m2.\033[0m Remove Frame\n");
    printf("\033[1;32m3.\033[0m Change Frame location\n");
    printf("\033[1;32m4.\033[0m Change Frame Time\n");
    printf("\033[1;32m5.\033[0m Change All Frames Time\n");
    printf("\033[1;32m6.\033[0m Show Frames\n");
    printf("\033[1;32m7.\033[0m Play Frames\n");
    printf("\033[1;32m8.\033[0m Save GIF\n");
    printf("\033[1;32m9.\033[0m Go Back\n");

    printf("\033[1;34m");
    printf("**********************\n");
    printf("\033[0m");

    printf("Enter your choice: ");
    if (scanf("%d", &choice) != 1) {
        printf("Invalid input\n");
        while (getchar() != '\n'); // clear the input buffer
        return -1;
    }

    return choice;
}

void file_menu() {
    int choice = 0;

    while (1) {
        printf("\033[1;34m");
        printf("**********************\n");
        printf("*       WELCOME      *\n");
        printf("*       TO THE       *\n");
        printf("*     GIF MAKER      *\n");
        printf("**********************\n");
        printf("\033[0m");
        printf("\033[1;32m1.\033[0m New GIF\n");
        printf("\033[1;32m2.\033[0m Load GIF\n");

        printf("Enter your choice: ");
        if (scanf("%d", &choice) != 1) {
            printf("Invalid input\n");
            while (getchar() != '\n');
            continue;
        }
        getchar(); 

        switch (choice) {
        case 1:
            system("cls"); 
            return; // Go to main menu
        case 2:
            system("cls"); 
            head = load_file();
            return; // Go to main menu
        default:
            printf("Invalid choice\n");
            break;
        }
    }
}

//CHEKE IF FILE EXISTS
int file_exists(const char* path) {
    FILE* file = fopen(path, "r");
    if (file) {
        fclose(file);
        return 1;
    }
    //fclose(file);
    return 0;
}

//CREATE NEW FRAME
FrameNode* new_frame(FrameNode* head) {
    char name[STRLEN];
    FrameNode* frameNode = (FrameNode*)malloc(sizeof(FrameNode));
    if (frameNode == NULL) {
        printf("Memory allocation failed for frameNode\n");
        return NULL;
    }

    Frame* frame = (Frame*)malloc(sizeof(Frame));
    if (frame == NULL) {
        printf("Memory allocation failed for frame\n");
         
        return NULL;
    }

    frame->name = (char*)malloc(STRLEN * sizeof(char));
    frame->path = (char*)malloc(STRLEN * sizeof(char));
    if (frame->name == NULL || frame->path == NULL) {
        printf("Memory allocation failed for frame name or path\n");
         
        return NULL;
    }

    frameNode->frame = frame;
    frameNode->next = NULL;

    int exists;
    FrameNode* temp;

    do {
        exists = 0; // Reset the flag for each new input attempt
        temp = head; // Reset temp to the head of the list
        getchar();
        printf("\nEnter name: ");
        fgets(name, STRLEN, stdin);
        name[strcspn(name, "\n")] = '\0';  // Remove the newline character

        while (temp != NULL) {
            if (strcmp(temp->frame->name, name) == 0) {
                exists = 1;
                break;
            }
            temp = temp->next;
        }

        if (exists) {
            printf("Name already exists. Enter another name.\n");
        }
        else {
            strcpy(frame->name, name);
            break; // Exit the loop if the name does not exist
        }
    } while (1);

    do {
        printf("Enter frame path: ");
        if (fgets(frame->path, STRLEN, stdin) == NULL) {
            printf("Fail to read the input stream\n");
             
            return NULL;
        }
        frame->path[strcspn(frame->path, "\n")] = '\0';

        if (file_exists(frame->path)) {
            break; // Exit the loop if the file exists
        }
        else {
            printf("File does not exist. Enter another path.\n");
        }
    } while (1);

    printf("Enter frame duration: ");
    if (scanf("%u", &frame->duration) != 1) {
        printf("Invalid input for duration\n");
         
        getchar(); // Clear the newline left by scanf
        return NULL;
    }
    getchar(); // Clear the newline left by scanf

    return frameNode;
}


//ADD A NEW FRAME
FrameNode* add_frame(FrameNode* head, FrameNode* new_node) {
    FrameNode* temp = head;
    if (head == '\0') {
        head = new_node;
    }
    else if (head->next == '\0') {
        head->next = new_node;
    }
    else {
        while (temp->next != '\0') {
            temp = temp->next;
        }
        temp->next = new_node;
    }
    new_node->next = '\0';
    return head;
}

//PRINT THE LIST
void frames_list(FrameNode* head) {
    FrameNode* temp = head;
    while (temp != '\0') {
        Frame* f = temp->frame;
        printf("NAME: %s\n", f->name);
        printf("TIME: %d\n", f->duration);
        printf("PATH: %s\n", f->path);
        printf("  |  \n");
        printf("  v  \n");
        temp = temp->next;
    }
    printf("  NULL  \n");
}
//CHNAGE ALL THE FRAMES TIME 
void change_all_frames_time(FrameNode* head, unsigned int time) {
    FrameNode* temp = head;
    while (temp != '\0') {
        temp->frame->duration = time;
        temp = temp->next;
    }
}

//ENTER TIME (FOR change_all_frames_time FUNC)
void enter_time(FrameNode* head) {
    unsigned int time = 0;
    printf("ENTER TIME:");
    scanf("%u", &time);
    change_all_frames_time(head, time);
}

//ENTER NAME (FOR change_frame_time FUNC)
void enter_name(FrameNode* head) {
    char name[STRLEN] = { 0 };
    unsigned int time = 0;
    printf("\nENTER FRAME NAME:");
    getchar(); // clear the newline left by previous scanf
    fgets(name, STRLEN, stdin);
    name[strcspn(name, "\n")] = '\0';  // Remove the newline character
    printf("\nENTER TIME:");
    scanf("%u", &time);
    change_frame_time(head, name, time);
}

//CHNAGE FRAME TIME
//HEAD- THE HEAD OF THE LIST
//NAME- FRAME NAME
//TIME- THE TIME THE USER CHOOSE(This will update the time of the frame)
void change_frame_time(FrameNode* head, char* name, unsigned int time) {
    FrameNode* temp = head;
    while (temp != '\0' && strcmp(temp->frame->name, name) != 0) {
        temp = temp->next;
    }
    if (temp == '\0') {
        printf("\nERROR");
        enter_name(head);
    }
    else {
        temp->frame->duration = time;
    }
}

//REMOVE FRAME
//HEAD- THE HEAD OF THE LIST
void remove_frame(FrameNode* head) {
    char name[STRLEN] = { 0 };
    FrameNode* temp = head;
    FrameNode* prev = '\0';

    printf("\nEnter name:");
    getchar(); // clear the newline left by previous input
    if (fgets(name, STRLEN, stdin) == '\0') {
        printf("Fail to read the input stream");
    }
    else {
        name[strcspn(name, "\n")] = '\0';  // Remove the newline character
    }

    while (temp != '\0' && strcmp(temp->frame->name, name) != 0) {
        prev = temp;
        temp = temp->next;
    }

    if (temp == '\0') {
        printf("Frame not found\n");
        return;
    }

    if (prev == '\0') { // Removing the head node
        head = temp->next;
    }
    else {
        prev->next = temp->next;
    }

     (temp->frame->name);
     (temp->frame->path);
     (temp->frame);
     (temp);
}

//CHANGE FRAME LOCATION TO THE  LOCATION THAT THE USER CHOOSE
//HEAD- THE HEAD OF THE LIST
void change_frame_loc(FrameNode** head) {
    if (*head == NULL) {
        printf("The list is empty.\n");
        return;
    }

    int location = 0;
    int counter = 1;
    char name[STRLEN] = { 0 };
    FrameNode* user_frame = *head;
    FrameNode* temp = *head;
    FrameNode* prev = NULL;
    FrameNode* user_prev = NULL;

    printf("Enter name: ");
    getchar();
    fgets(name, STRLEN, stdin);
    name[strcspn(name, "\n")] = '\0';

    while (user_frame != NULL && strcmp(user_frame->frame->name, name) != 0) {
        user_prev = user_frame;
        user_frame = user_frame->next;
        counter++;
    }

    if (user_frame == NULL) {
        printf("Frame not found.\n");
        return;
    }

    int list_length = 0;
    temp = *head;
    while (temp != NULL) {
        list_length++;
        temp = temp->next;
    }

    printf("Enter new location: ");
    if (scanf("%d", &location) != 1) {
        printf("Invalid input.\n");
        while (getchar() != '\n'); // Clear the input buffer
        return;
    }

    while (getchar() != '\n'); // Clear the input buffer

    if (location < 1 || location > list_length) {
        printf("Invalid location.\n");
        return;
    }

    if (location == counter) {
        printf("Frame is already at the specified location.\n");
        return;
    }

    // Remove user_frame from its current position
    if (user_prev == NULL) {
        *head = user_frame->next;
    }
    else {
        user_prev->next = user_frame->next;
    }

    // Insert user_frame at the new location
    temp = *head;
    prev = NULL;

    for (int i = 1; i < location; i++) {
        prev = temp;
        temp = temp->next;
    }

    if (prev == NULL) {
        user_frame->next = *head;
        *head = user_frame;
    }
    else {
        user_frame->next = prev->next;
        prev->next = user_frame;
    }

    printf("Frame moved successfully.\n");
}

//FREE ALL THE NODES
//HEAD- THE HEAD OF THE LIST
void free_all(FrameNode* head) {
    FrameNode* temp;
    while (head != NULL) {
        temp = head;
        head = head->next;

        free(temp->frame->name);
        free(temp->frame->path);

        free(temp->frame);

        free(temp);
    }
}

//SAVE FILE  IN A PATH THAT THE USER CHOOSE
//HEAD- THE HEAD OF THE LIST
void save_file(FrameNode* head) {
    char file_path[STRLEN];
    getchar();
    printf("Enter file path to save the project: ");
    if (fgets(file_path, STRLEN, stdin) == NULL) {
        printf("Fail to read the input stream\n");
        //return NULL;
    }
    file_path[strcspn(file_path, "\n")] = '\0';

    FILE* file = fopen(file_path, "w");
    if (file == NULL) {
        printf("Failed to open file for writing\n");
        //return NULL;
    }

    FrameNode* temp = head;
    while (temp != NULL) {
        fprintf(file, "%s,%u,%s\n", temp->frame->path, temp->frame->duration, temp->frame->name);
        temp = temp->next;
    }

    fclose(file);
}

//LOAD FILE BY IMAGE PATH AND RETURN THE HEAD OF THE LIST
FrameNode* load_file() {
    FrameNode* head = NULL;
    FrameNode* tail = NULL;
    char line[STRLEN];
    char file_path[STRLEN];

    printf("Enter file path to load the project: ");
    if (fgets(file_path, STRLEN, stdin) == NULL) {
        printf("Failed to read the input stream\n");
        return NULL;
    }
    file_path[strcspn(file_path, "\n")] = '\0';

    FILE* file = fopen(file_path, "r");
    if (file == NULL) {
        printf("Failed to open file for reading\n");
        return NULL;
    }

    while (fgets(line, sizeof(line), file)) {
        line[strcspn(line, "\n")] = '\0'; // Remove trailing newline character

        FrameNode* new_node = (FrameNode*)malloc(sizeof(FrameNode));
        if (!new_node) {
            printf("Memory allocation failed for new node\n");
            fclose(file);
            return NULL;
        }

        Frame* new_frame = (Frame*)malloc(sizeof(Frame));
        if (!new_frame) {
            printf("Memory allocation failed for new frame\n");
            free(new_node);
            fclose(file);
            return NULL;
        }

        // Manually parse the line
        char* path = strtok(line, ",");
        char* duration_str = strtok(NULL, ",");
        char* name = strtok(NULL, ",");

        if (path) {
            new_frame->path = strdup(path);
            if (new_frame->path == NULL) {
                printf("Memory allocation failed for path\n");
                free(new_frame);
                free(new_node);
                fclose(file);
                return NULL;
            }
        }
        else {
            new_frame->path = NULL;
        }

        if (duration_str) {
            new_frame->duration = atoi(duration_str);
        }
        else {
            new_frame->duration = 0; // Default value if missing
        }

        if (name) {
            new_frame->name = strdup(name);
            if (new_frame->name == NULL) {
                printf("Memory allocation failed for name\n");
                free(new_frame->path);
                free(new_frame);
                free(new_node);
                fclose(file);
                return NULL;
            }
        }
        else {
            new_frame->name = NULL;
        }

        new_node->frame = new_frame;
        new_node->next = NULL;

        if (head == NULL) {
            head = new_node;
            tail = new_node;
        }
        else {
            tail->next = new_node;
            tail = new_node;
        }
    }

    fclose(file);
    return head;
}

