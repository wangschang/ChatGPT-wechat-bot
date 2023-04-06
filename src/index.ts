import { WechatyBuilder } from "wechaty";
import qrcodeTerminal from "qrcode-terminal";
import config from "./config.js";
import ChatGPT from "./chatgpt.js";
//引入cache
import NodeCache from "node-cache";
const myCache = new NodeCache({ stdTTL:86400});

let bot: any = {};
const startTime = new Date();
let chatGPTClient: any = null;
initProject();
async function onMessage(msg) {
  // 避免重复发送
  if (msg.date() < startTime) {
    return;
  }
  const contact = msg.talker();
  const receiver = msg.to();
  const content = msg.text().trim();
  const room = msg.room();
  const alias = (await contact.alias()) || (await contact.name());
  const isText = msg.type() === bot.Message.Type.Text;
  if (msg.self()) {
    return;
  }
  
  if (room && isText) {
    const topic = await room.topic();
    //判断是否在白名单中2023
    if(config.groupNames !=""){
       let groupnames = config.groupNames.toString().split(",")
        let group_allow = false
        for(var i =0;i<groupnames.length;i++){
            if(groupnames[i] == topic){
              group_allow = true
            }
        }
        if(!group_allow){
           console.log(
            `Group name: ${topic} is not in whitelist`
          ); 
          return;
        }
        console.log(
          `Group name: ${topic} talker: ${await contact.name()} content: ${content}`
        ); 
    }
    //判断用户是否达到发送的上限2023
    if(config.userLimit > 0){
      const now = new Date();
      //now.getFullYear() now.getMonth() now.getDate()
      let cacheKey = now.getFullYear() + ":" + now.getMonth() + ":"+ now.getDate()+ ":" +contact.name();
      let val = Number(myCache.get(cacheKey));
      console.log(`userlimitkey:${cacheKey},val:${val}`);
      if(val == undefined  || val == 0 || isNaN(val) ){
        myCache.set(cacheKey,1);
      }else{
        if(val >= config.userLimit){
          console.log(
            `Group name: ${topic} talker: ${await contact.name()} content: ${content} reach max limit today`
          ); 
          return;
        }else{
          myCache.set(cacheKey,val + 1)
        }
      }
    }

    const pattern = RegExp(`^@${receiver.name()}\\s+${config.groupKey}[\\s]*`);
    if (await msg.mentionSelf()) {
      if (pattern.test(content)) {
        const groupContent = content.replace(pattern, "");
        chatGPTClient.replyMessage(room, groupContent);
        return;
      } else {
        console.log(
          "Content is not within the scope of the customizition format"
        );
      }
    }
  } else if (isText) {
    console.log(`talker: ${alias} content: ${content}`);
    if (content.startsWith(config.privateKey) || config.privateKey === "") {
      let privateContent = content;
      if (config.privateKey === "") {
        privateContent = content.substring(config.privateKey.length).trim();
      }
      chatGPTClient.replyMessage(contact, privateContent);
    } else {
      console.log(
        "Content is not within the scope of the customizition format"
      );
    }
  }
}

function onScan(qrcode) {
  qrcodeTerminal.generate(qrcode, { small: true }); // 在console端显示二维码
  const qrcodeImageUrl = [
    "https://api.qrserver.com/v1/create-qr-code/?data=",
    encodeURIComponent(qrcode),
  ].join("");

  console.log(qrcodeImageUrl);
}

async function onLogin(user) {
  console.log(`${user} has logged in`);
  const date = new Date();
  console.log(`Current time:${date}`);
}

function onLogout(user) {
  console.log(`${user} has logged out`);
}

async function initProject() {
  try {
    chatGPTClient = new ChatGPT();
    bot = WechatyBuilder.build({
      name: "WechatEveryDay",
      puppet: "wechaty-puppet-wechat", // 如果有token，记得更换对应的puppet
      puppetOptions: {
        uos: true,
      },
    });

    bot
      .on("scan", onScan)
      .on("login", onLogin)
      .on("logout", onLogout)
      .on("message", onMessage);

    bot
      .start()
      .then(() => console.log("Start to log in wechat..."))
      .catch((e) => console.error(e));
  } catch (error) {
    console.log("init error: ", error);
  }
}
