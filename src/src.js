	function log(m){
		document.getElementById("logs").textContent = document.getElementById("logs").textContent+"\n"+m;
		return m;
	}
	function status(s){
		document.getElementById("stats").textContent = "STATUS: "+s;
	}
	console.error = function(e,b,c,k,l){
		var a = [e,b,c,k,l];
		log("[ERROR] "+a.join(" "));
	}
	async function checkConn(conn){
		var con = false;
		conn.on('open', function() {
			con=true;
			conn.close();
		});
		await new Promise(resolve => setTimeout(resolve, 400));
		return con;
	}
	async function onReady(id){
		log("readied peerjs with id "+id);
		status("Attempting to join existing network");
		var cb = "nullfound";
		for(var i = 0; i<=10; i++){
			//`openfnm-node${i}-x`
			//"603f7dde-1d37-425b-8f5c-0e2a081a5859"
			var conn = peer.connect(`openfnm-node${i}-x`);
			var w = await checkConn(conn);
			if(!w){
				log(`connection to node${i} failed`);
			} else {
				log(`connection to node${i} succeded`);
				cb=i;
				break;
			}
		}
		if(cb=="nullfound"){
			status("Creating new network");
			log("failed to find existing network, starting network");
			log("rewrite self with data found, init peerjs with specific id");
			window._openfmn = {
				"created": new Date().getTime(),
				"nodes": [
					{id: "0", time: new Date().getTime() }
				]
			}
			window._cid = 0;
			peer.destroy();
			peer = new Peer(`openfnm-node0-x`, {"debug": 1});
			peer.on('open', function(id) {
				status("Created network, waiting for participants");
				log("registered as "+id+", defining join functions");
				participate(peer);
			});
		} else {
			var conn = peer.connect(`openfnm-node${cb}-x`);
			status("Attempting to join discovered network");
			conn.on('open', function() {
				conn.send({
					"type": "join",
					"time": new Date().getTime()
				});
				conn.on("data", function(data){
					if(data.type == "jmap"){
						log("got network map to join");
						console.log(data.map);
						joinNetwork(data.map,cb);
					}
				});
			});
		}
	}
	function joinNetwork(map,entry){
		var cid = undefined;
		for(var i=0;i>-1;i++){
			var f = true
			for(var k in map.nodes){
				if(map.nodes[k]["id"] == i){
					f=false;
				}
			}
			if(f){
				cid = i;
				break;
			}
			if(i>500) {log("critical no id 500 && throw");throw "";};
		}
		log("register with id "+cid);
		var conn = peer.connect(`openfnm-node${entry}-x`);
		status("Registering in network");
		conn.on('open', function() {
			conn.send({
				"type": "register",
				"id": cid,
				"time": new Date().getTime()
			});
			conn.on("data", function(data){
				if(data.type == "welcome"){
					log("accepted into network with new network map: ");
					log(JSON.stringify(data));
					window._openfmn = data.jmap;
					window._cid = cid;
					conn.close();
					peer.destroy();
					peer = new Peer(`openfnm-node${cid}-x`, {"debug": 1});
					peer.on("open", function(){
						status("Connected and participating in network");
						log("peer opened");
						participate(peer);
						window._con = {};
						connectTo(window._openfmn["nodes"]);
					});
				}
			});
		});
	}
	function participate(peer){
		peer.on('connection', function(conn) {
			conn.on('data', function(data) {
				log('Received '+JSON.stringify(data));
				if(data.type == "join"){
					log("sent map to discovering peer");
					conn.send({
						type: "jmap",
						map: window._openfmn
					});
				}
				if(data.type == "register"){
					window._openfmn["nodes"].push({
						id: data.id,
						time: new Date().getTime()
					});
					log("made discover to node (type:welcome)");
					conn.send({
						type: "welcome",
						jmap: window._openfmn
					});
					connectTo(window._openfmn["nodes"]);
					setTimeout(function(){
						broadcast({
							"type": "new",
							"jmap": window._openfmn
						});
					}, 1000);
				}
				if(data.type == "new"){
					log("Updating memeber list");
					window._openfmn = data.jmap;
					connectTo(data.jmap["nodes"]);
				}
				executeFunctions(data,conn.peer);
			});
		});
	}
	function connectTo(net){
		if(window._con == undefined)window._con = {};
		log("establishing new paths from "+JSON.stringify(net));
		for(var i in net){
			console.log(Object.keys(window._con), net[i]["id"]);
			if(net[i]["id"] == window._cid || Object.keys(window._con).indexOf(net[i]["id"]+"") != -1){
				log(`omit ${net[i]["id"]} for ${net[i]["id"] == window._cid}:${Object.keys(window._con).indexOf(net[i]["id"]+"") != -1}`)
				continue;
			}
			log(`paving to node ${net[i]["id"]}`);
			regularParticipate(net[i]["id"]);
		}
		console.log(window._con);
		var s = "";
		if(Object.keys(window._con).length>1) s = "s";
		status(`Connected to ${Object.keys(window._con).length} node${s}`);
	}
	function regularParticipate(pif){
		var conn = peer.connect(`openfnm-node${pif}-x`);
		window._con[pif] = conn;
		//forward, handle leaves
		conn.on('open', function() {
			log("got regNet "+pif);
		});
		conn.on("data", function(data){
			log("[regularNetwork]: got "+JSON.stringify(data));
		});
		conn.on("close", function(){
			log("regNet: conn closed to id "+pif);
			delete window._con[pif];
			for(var i in window._openfmn["nodes"]){
				if(window._openfmn["nodes"][i]["id"] == pif){
					window._openfmn["nodes"].splice(i, 1);
				}
			}
			log("now connected to "+Object.keys(window._con).length+" nodes");
			status("Connected to "+Object.keys(window._con).length+" nodes");
			console.log(window._con);
		});
	}
	function broadcast(data){
		log("! - Broadcast: to "+Object.keys(window._con).length+" nodes");
		for(var i in window._con){
			window._con[i].send(data);
			log("sent data to node"+i);
		}
	}
	//register a function passed as a parameter to the function to window._eventHandlers
	function registerFunction(func){
		//if window._eventHandlers is undefined, create it
		if(window._eventHandlers == undefined)window._eventHandlers = [];
		window._eventHandlers.push(func);
	}
	//execute all functions in list window._eventHandlers with parameter data
	function executeFunctions(data,id){
		for(var i in window._eventHandlers){
			window._eventHandlers[i](data,id);
		}
	}
	window.onerror = function(message, source, lineno, colno, error) {
		log("Critical exception: "+message+" on line "+lineno+" : "+error);
	};
	try{
		log("started");
		var peer = new Peer({"debug": 1});
		peer.on('open', function(id) {
			peer.on('open', function(id){
				log("re registered with id "+id);
			});
			log("fired onready event");
			onReady(id)
		});
	}catch(e){
		log(e);
	}
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
		document.getElementById("msgs").textContent=document.getElementById("msgs").textContent+"\n"+"[System (hidden)]: Checking name.";
		scrollEnd();
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
	var spam = {};
	registerFunction((function(data,id){
		if(data.type == "bsc_msg"){
			if(muted.indexOf(data.name) == -1){
				var s = data.name;
				if(spam[s] == undefined){
					spam[s] = 7;
					setTimeout((function(ss){
						spam[ss] = spam[ss]+1;
					}), 6000, s);
				} else {
					if(spam[s]-1<1){
						spam[s] = spam[s]-1;
						setTimeout((function(ss){
							spam[ss] = spam[ss]+1;
						}), 8000, s);
						if(spam["_sp"] == undefined || spam["_sp"] == false){
							document.getElementById("msgs").textContent=document.getElementById("msgs").textContent+"\n"+"[System (hidden)]: "+data.name+" appears to be spamming. Consider muting them with /mute "+data.name;
							scrollEnd();
							spam["_sp"] = true;
							setTimeout((function(){
								spam["_sp"] = false;
							}), 10000);
						}

					} else {
						spam[s] = spam[s]-1;
						setTimeout((function(ss){
							spam[ss] = spam[ss]+1;
						}), 6000, s);
					}
				}
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
	//UI FUNCTIONALITY SCRIPTS
	var ntlgt_state = true;
	document.getElementById("ntlgt").addEventListener("click", function(){
		console.log(ntlgt_state);
		if(ntlgt_state){
			document.getElementById("logs").style.display = "none";
			document.getElementById("ntlgt").textContent = "Show logs";
			ntlgt_state = false;
		} else {
			document.getElementById("logs").style.display = "block";
			document.getElementById("ntlgt").textContent = "Hide logs";
			ntlgt_state = true;
		}
	});
	function scrollEnd(){
		var element = document.getElementById("lazy");
		element.scrollTop = element.scrollHeight;
	}
