function Slack2SheetPost(jsonObj, score) {
  // スプレットシートに記述する
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('index');
  var newRow = sheet.getLastRow() + 1;

  sheet.getRange(newRow, 1).setValue(jsonObj["event_time"]); // タイムスタンプ
  sheet.getRange(newRow, 2).setValue(jsonObj["event_id"]); // イベントID
  sheet.getRange(newRow, 3).setValue(jsonObj["event"]["user"]); // ユーザーID
  sheet.getRange(newRow, 4).setValue(jsonObj["event"]["text"]); // 本文
  sheet.getRange(newRow, 5).setValue(score); // score
  sheet.getRange(newRow, 6).setValue(-1); // likes
  sheet.getRange(newRow, 7).setValue("Slack"); // slack or twitter
  var link = "https://dajarerits.slack.com/archives/" + jsonObj["event"]["channel"] + "/p";
  sheet.getRange(newRow, 8).setValue(link + jsonObj["event"]["ts"].replace('.','')); // link
  sheet.getRange(newRow, 9).setValue(""); // 備考
}

function RegularExpressionJudge(jsonObj, word) {
  return jsonObj["event"]["text"].match(word);
}

function SlackValidation(e) {
  var jsonObj = JSON.parse(e.postData.getDataAsString());

  // observerの投稿は弾く
  if(jsonObj["event"]["user"] == "UUJQJ0YQG") {
    return false;
  }

  // slackのchannelに参加した時のイベントを取り除く
  // この場合「<userid>~~~」という文字列がtextに入る
  var JoinWord = new RegExp("^<@" + jsonObj["event"]["user"] + ">.*");
  if(RegularExpressionJudge(jsonObj, JoinWord)) {
    return false;
  }

  // slackのリアクションイベントは弾く
  // この場合「: ~~~~ :」という文字列がtextに入る
  var ReactionwWord = new RegExp("^:.*:$");
  if(RegularExpressionJudge(jsonObj, ReactionwWord)) {
    return false;
  }
  
  // 前回のダジャレとイベントIDが一緒の時は弾く
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('index');
  var lastRow = sheet.getLastRow();
  var event_id = sheet.getRange(lastRow, 2).getValue();
  if(jsonObj["event_id"] == event_id) {
    return false;
  }

  // bottest,ダジャレチャンネル以外からのアクセスは弾く
  if(jsonObj["event"]["channel"] != "CTZKSMLCA" && jsonObj["event"]["channel"] != "CU8LLRTEV") {
    return false;
  }

  return jsonObj;
}

function SlackPost(channel, jsonObj, score) {
  // Slackの特定のチャンネルに投稿
  var token = PropertiesService.getScriptProperties().getProperty('SLACK_ACCESS_TOKEN');  
  var slackApp = SlackApp.create(token); //SlackApp インスタンスの取得
  
  // 投稿メッセージ生成
  var template_string = "【${time}】\nダジャレ：${joke}\n名前：${name}\n評価：${score}";
  var date = new Date(Number(jsonObj["event_time"])*1000); // Dateオブジェクト生成
  var date_string = Utilities.formatDate(date,"JST","yyyy/MM/dd HH:mm:ss");

  template_string = template_string.replace("${time}", date_string);
  template_string = template_string.replace("${joke}", jsonObj["event"]["text"]);
  template_string = template_string.replace("${name}", jsonObj["event"]["user"]);
  template_string = template_string.replace("${score}", ('★'.repeat(score) + '☆'.repeat(5 - score)));

  var options = {
    channelId: channel, // チャンネル名
    userName: "obserber", // 投稿するbotの名前
    // 投稿するメッセージ
    message: template_string,
  };

  // 投稿
  slackApp.postMessage(options.channelId, options.message, {username: options.userName});
}

function AccessJudgeApi(joke, base_url) {
  var api_url = "/joke/judge/?joke=";
  var response = UrlFetchApp.fetch(base_url+ api_url + joke).getContentText();
  var res_json = JSON.parse(response);
  return res_json["is_joke"];
}

function AccessEvaluateApi(joke, base_url) {
  var api_url = "/joke/evaluate/?joke=";
  var response = UrlFetchApp.fetch(base_url+ api_url + joke).getContentText();
  var res_json = JSON.parse(response);
  return Math.round(Number(res_json["score"]) * 10) / 10;
}

function test(jsonObj) {

  var base_url = "https://ee4ac409.ngrok.io";

  // ダジャレ判定APIにアクセス
  var isjoke = AccessJudgeApi(jsonObj["event"]["text"], base_url);
  if(!isjoke) {
    return;
  }

  // ダジャレ評価APIにアクセス
  var score = AccessEvaluateApi(jsonObj["event"]["text"], base_url);

  // #ついったーに投稿
  var twitter_score = Math.round(score);
  SlackPost("#ついったー", jsonObj, twitter_score);

  // スプレットシートに保存
  Slack2SheetPost(jsonObj, score);
}

function doPost(e) {
  var jsonObj = SlackValidation(e);
  if(jsonObj != false) {
    test(jsonObj);
  }
}