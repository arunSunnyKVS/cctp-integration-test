const url = 'https://iris-api-sandbox.circle.com/v2/messages/5?transactionHash=4m13v5xkdwwWQAuX8z8uiFeqdiA6vHuK6mNaWgmw7kdVyF9foUyihJBTAR2PnU5WcbckQ2g8USRsZfj3YtbVuUSj';
const options = {method: 'GET', headers: {'Content-Type': 'application/json'}};

fetch(url, options)
  .then(res => res.json())
  .then(json => console.log(json))
  .catch(err => console.error('error:' + err));