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
