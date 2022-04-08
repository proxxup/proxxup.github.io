var muted = [];
//listen to enter key on input
document.getElementById("input").addEventListener("keyup", function(event) {
	event.preventDefault();
	if (event.keyCode === 13) {
		sendMessage(document.getElementById("input").value);
	}
});
//send message to all nodes in network window._con
//and it's name
function sendMessage(message){
	if(message == ""){
		document.getElementById("msgs").textContent=document.getElementById("msgs").textContent+"\n"+"[System (hidden)]: You must enter a message to send.";
		scrollEnd();
		return false;
	}
	if(message.length > 255){
		document.getElementById("msgs").textContent=document.getElementById("msgs").textContent+"\n"+"[System (hidden)]: Message is too long.";
		scrollEnd();
		return false;
	}
	if(message.indexOf("<") != -1 || message.indexOf(">") != -1){
		document.getElementById("msgs").textContent=document.getElementById("msgs").textContent+"\n"+"[System (hidden)]: Message contains invalid characters.";
		scrollEnd();
		return false;
	}
	//check for custom comannds starting with "/"
	if(message.indexOf("/") == 0){
		var cmd = message.replace("/","");
		cmd = cmd.split(" ");
		if(cmd[0] == "mute"){
			muted.push(cmd[1]);
			document.getElementById("msgs").textContent=document.getElementById("msgs").textContent+"\n"+"[System (hidden)]: Muted "+cmd[1];
		scrollEnd();
			document.getElementById("input").value = "";
			return false;
		} else if(cmd[0] == "unmute"){
			muted.splice(muted.indexOf(cmd[1]), 1);
			document.getElementById("msgs").textContent=document.getElementById("msgs").textContent+"\n"+"[System (hidden)]: Unmuted "+cmd[1];
		scrollEnd();
			document.getElementById("input").value = "";
			return false;
		} else if(cmd[0] == "viewmutes"){
			document.getElementById("msgs").textContent=document.getElementById("msgs").textContent+"\n"+"[System (hidden)]: Muted: "+muted.join(", ");
		scrollEnd();
			document.getElementById("input").value = "";
			return false;
		}
	}
	if(window._cname == undefined){
		document.getElementById("msgs").textContent=document.getElementById("msgs").textContent+"\n"+"[System (hidden)]: You must set a name before sending messages.";
		scrollEnd();
		return false;
	}
	var data = {
		"type": "bsc_msg",
		"message": message,
		"name": window._cname
	};
	broadcast(data);
	document.getElementById("msgs").textContent=document.getElementById("msgs").textContent+"\n"+`[${window._cname}]: `+message;
		scrollEnd();
	document.getElementById("input").value = "";
}
//pass the name from the input ro setName()
function sendMsg(){
	setName(document.getElementById("name").value);
}
//read name and verify with entire network that it is not taken
function setName(name){
	if(name == ""){
		document.getElementById("msgs").textContent=document.getElementById("msgs").textContent+"\n"+"[System (hidden)]: You must enter a name.";
		scrollEnd();
		return false;
	}
	if(name.length > 255){
		document.getElementById("msgs").textContent=document.getElementById("msgs").textContent+"\n"+"[System (hidden)]: Name is too long.";
		scrollEnd();
		return false;
	}
	if(name.match(/^[0-9a-zA-Z]+$/) ? false : true){ //if contains, returns false because false : true flipped
		document.getElementById("msgs").textContent=document.getElementById("msgs").textContent+"\n"+"[System (hidden)]: Name must be alphanumeric.";
		scrollEnd();
		return false;
	}
	var data = {
		"type": "set_name",
		"name": name
	};
	if(window._cname != undefined){
		data["pname"] = window._cname;
	}
	window._nameCallback = true;
	broadcast(data);
	setTimeout(function(){
		if(window._nameCallback == false){
			document.getElementById("msgs").textContent=document.getElementById("msgs").textContent+"\n"+"[System (hidden)]: Name is already taken.";
		scrollEnd();
		}else{
			window._cname = name;
			document.getElementById("msgs").textContent=document.getElementById("msgs").textContent+"\n"+"[System (hidden)]: Name set to "+name+".";
		scrollEnd();
		}
	}, 3000)
}
registerFunction((function(data,id){
	if(data.type == "bsc_msg"){
		if(muted.indexOf(data.name) == -1){
			document.getElementById("msgs").textContent=document.getElementById("msgs").textContent+"\n"+`[${data.name}]: `+data.message;
			scrollEnd();
		}
	}
	if(data.type == "set_name"){
		if(muted.indexOf(data.pname) != -1){
			muted.push(data.name);
		}
		if(data.name == window._cname){
			//send name back to sender using existing connection found by looping through window._con
			for(var i in window._con){
				if(window._con[i].peer == id){
					window._con[i].send({"type": "name_fail", "name": window._cname});
				}
			}
		}	
	}
	if(data.type == "name_fail" && window._nameCallback == true){
		window._nameCallback = false;
	}
}));
