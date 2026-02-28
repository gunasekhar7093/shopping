const socket = io();

/* VARIABLES */
let reconnectAttempts = 0;
let maxReconnectAttempts = 5;
let reconnecting = false;

let muted = false;
let ringtone;

let timerInterval = null;
let seconds = 0;

let localStream = null;
let peer = null;

let myName;
let callerID = null;
let callerName = null;


function monitorConnection(){

if(!peer) return;

peer.onconnectionstatechange = ()=>{

let state = peer.connectionState;

console.log("Connection State:", state);

if(state === "connected"){

reconnectAttempts = 0;
reconnecting = false;

document.getElementById("connectionStatus").innerHTML =
"🟢 Connected";

}

if(state === "disconnected" || state === "failed"){

if(reconnecting) return;

reconnecting = true;

document.getElementById("connectionStatus").innerHTML =
"🟡 Reconnecting...";

tryReconnect();

}

if(state === "closed"){

document.getElementById("connectionStatus").innerHTML =
"⚫ Disconnected";

}

};

}

/* tryReconnectR */
function tryReconnect(){

if(reconnectAttempts >= maxReconnectAttempts){

document.getElementById("callStatus").innerHTML =
"Connection Lost";

document.getElementById("connectionStatus").innerHTML =
"🔴 Disconnected";

setTimeout(()=>{

stopCallUI();

},2000);

return;

}

reconnectAttempts++;

console.log("Reconnect attempt:", reconnectAttempts);

setTimeout(()=>{

if(peer){

peer.restartIce();

}

reconnecting=false;

},3000);

}

/* STUN SERVER */

const configuration = {

iceServers: [

{
urls: [
"stun:stun.l.google.com:19302",
"stun:stun1.l.google.com:19302",
"stun:stun2.l.google.com:19302",
"stun:stun3.l.google.com:19302"
]
}

],

iceCandidatePoolSize: 10

};


/* TIMER */

function startTimer(){

if(timerInterval) return;

seconds=0;

timerInterval=setInterval(()=>{

seconds++;

let min=Math.floor(seconds/60);
let sec=seconds%60;

if(min<10) min="0"+min;
if(sec<10) sec="0"+sec;

document.getElementById("callTimer").innerHTML =
min+":"+sec;

},1000);

}


/* STOP TIMER */

function stopTimer(){

if(timerInterval){

clearInterval(timerInterval);
timerInterval=null;

}

seconds=0;

document.getElementById("callTimer").innerHTML="00:00";

}


/* JOIN */

function join(){

myName = document.getElementById("name").value;

ringtone = document.getElementById("ringtone");

socket.emit("join", myName);

document.getElementById("login").style.display="none";
document.getElementById("main").style.display="block";

}


/* USER LIST */

socket.on("users", users => {

let div="";

for(let id in users){

if(users[id] !== myName){

div += `
<div class="userRow">

${users[id]}

<button class="callBtn"
onclick="callUser('${id}','${users[id]}')">

📞 Call

</button>

</div>
`;

}

}

document.getElementById("users").innerHTML=div;

});


/* CALL USER */

async function callUser(id,name){

callerID=id;
callerName=name;

document.getElementById("callScreen").style.display="block";

document.getElementById("callUserName").innerHTML=name;

document.getElementById("callStatus").innerHTML="Calling...";

document.getElementById("connectionStatus").innerHTML=
"🟡 Calling";


localStream = await navigator.mediaDevices.getUserMedia({
audio:true
});


peer = new RTCPeerConnection(configuration);

monitorConnection();

localStream.getTracks().forEach(track=>{
peer.addTrack(track,localStream);
});


peer.ontrack=e=>{

document.getElementById("remoteAudio").srcObject=e.streams[0];

document.getElementById("callStatus").innerHTML="Connected";

document.getElementById("connectionStatus").innerHTML=
"🟢 Connected";

startTimer();

};


peer.onicecandidate=e=>{

if(e.candidate){

socket.emit("iceCandidate",{
to:id,
candidate:e.candidate
});

}

};


let offer = await peer.createOffer();

await peer.setLocalDescription(offer);


socket.emit("callUser",{
to:id,
offer:offer
});

}


/* INCOMING CALL */

socket.on("incomingCall", data=>{

callerID=data.from;
callerName=data.name;

ringtone.play();

document.getElementById("incomingCall").style.display="block";

document.getElementById("callerName").innerHTML=
callerName + " is calling";

window.offer=data.offer;

});


/* ACCEPT CALL */

async function acceptCall(){

ringtone.pause();
ringtone.currentTime=0;

document.getElementById("incomingCall").style.display="none";

document.getElementById("callScreen").style.display="block";

document.getElementById("callUserName").innerHTML=
callerName;

document.getElementById("callStatus").innerHTML=
"Connecting...";

document.getElementById("connectionStatus").innerHTML=
"🟡 Connecting";


localStream = await navigator.mediaDevices.getUserMedia({
audio:true
});


peer = new RTCPeerConnection(configuration);


localStream.getTracks().forEach(track=>{
peer.addTrack(track,localStream);
});


peer.ontrack=e=>{

document.getElementById("remoteAudio").srcObject=e.streams[0];

document.getElementById("callStatus").innerHTML=
"Connected";

document.getElementById("connectionStatus").innerHTML=
"🟢 Connected";

startTimer();

};


peer.onicecandidate=e=>{

if(e.candidate){

socket.emit("iceCandidate",{
to:callerID,
candidate:e.candidate
});

}

};


await peer.setRemoteDescription(window.offer);


let answer = await peer.createAnswer();

await peer.setLocalDescription(answer);


socket.emit("answerCall",{
to:callerID,
answer:answer
});

}


/* CALL ACCEPTED */

socket.on("callAccepted", async data=>{

await peer.setRemoteDescription(data.answer);

document.getElementById("callStatus").innerHTML=
"Connected";

document.getElementById("connectionStatus").innerHTML=
"🟢 Connected";

startTimer();

});


/* REJECT CALL */

function rejectCall(){

socket.emit("rejectCall",{
to:callerID
});

stopCallUI();

}


/* CALL REJECTED */

socket.on("callRejected", ()=>{

document.getElementById("callStatus").innerHTML=
"Call Rejected";

document.getElementById("connectionStatus").innerHTML=
"🔴 Rejected";

setTimeout(()=>{

stopCallUI();

},1500);

});


/* ICE */

socket.on("iceCandidate", async candidate=>{

try{

if(peer && candidate){

await peer.addIceCandidate(new RTCIceCandidate(candidate));

}

}catch(e){

console.log("ICE error",e);

}

});


/* MUTE */

function toggleMute(){

if(!localStream) return;

muted=!muted;

localStream.getAudioTracks()[0].enabled=!muted;

let btn=document.getElementById("muteBtn");

if(muted){

btn.innerHTML=" 🔇Unmute";
btn.classList.add("muteOff");

}
else{

btn.innerHTML=" 🔊 Mute ";
btn.classList.remove("muteOff");

}

}


/* END CALL */

function endCall(){

socket.emit("endCall",{
to:callerID
});

stopCallUI();

}


/* RECEIVE END CALL */

socket.on("callEnded", ()=>{

document.getElementById("callStatus").innerHTML=
"Call Ended";

document.getElementById("connectionStatus").innerHTML=
"⚫ Disconnected";

setTimeout(()=>{

stopCallUI();

},1200);

});


/* STOP UI */

function stopCallUI(){

/* Stop Timer */

stopTimer();

/* Stop Ringtone */

if(ringtone){
ringtone.pause();
ringtone.currentTime=0;
}

/* Close WebRTC */

if(peer){
peer.close();
peer=null;
}

if(localStream){
localStream.getTracks().forEach(track=>track.stop());
localStream=null;
}

/* Reset Call Info */

callerID=null;
callerName=null;

/* Hide Screens */

document.getElementById("callScreen").style.display="none";
document.getElementById("incomingCall").style.display="none";

/* Reset Status */

document.getElementById("connectionStatus").innerHTML=
"⚫ Disconnected";

}

/* userDisconnected */
socket.on("userDisconnected", (id)=>{

// If the disconnected user was in call
if(id === callerID){

document.getElementById("callStatus").innerHTML =
"User Offline";

document.getElementById("connectionStatus").innerHTML =
"🔴 Disconnected";

setTimeout(()=>{

stopCallUI();

},1500);

}


});
