# Configuration file

When running in the native environment, save `sample.capw` as `.capw` in your home directory.
For the Docker environment, copy `sample.capw` to this directory under the name `.capw`.

## Configurable items

The configuration file is in json format.

```
{
   "": "If set to true, the menu bar and development tools will be displayed.",
   "DEBUG": false,

   "": "If set to false, the status file will not be saved when the window is closed.",
   "save_last_status": true,
   
   "": "If set to true, the status file will be ignored when the application starts up.",
   "ignore_last_status": false,
   
   "UI": {
   	"": "If set to true, the OS default title bar will be hidden.".
	"": "Note that if you hide the title bar, you may not be able to move or resize the window in docker environments or X11 environments other than Wayland.",
	"hide_titlebar": false,

	"": "When set to false, if you move to another image or folder while editing the caption, a confirmation dialog will appear.",
	"": "When set to true, no confirmation dialog will be displayed, and the edited content will be saved automatically.",
	"auto_commit": true,
	
	"": "If set to false, when deleting a caption, the confirmation dialog will no longer be displayed.",
	"dispose_without_confirm": false,

	"": "If set to false, the built-in spell checker will be disabled.",
	"spellcheck": true,

	"": "If set to false, the built-in spell completer will be disabled.",
	"autocomplete": false,

	"": "You can specify the message that is displayed when the screen is locked.",
	"lockscreen_message": '',
	
	"": ""
     },
   "": "",
}
```
