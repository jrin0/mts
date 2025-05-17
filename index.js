require('dotenv').config();
const fastify = require('fastify')();
const { fetch, request } = require('undici');
const { RSI, BollingerBands } = require('technicalindicators');
const moment = require('moment-timezone');
const PORT = process.env.PORT || 3000;

async function getData(from, to) {
	// const link = `https://tradingview.mtsgold.co.th/mgb/history?symbol=GLD965&resolution=15&from=1747401348&to=1747410348&countback=2&currencyCode=THB`
	const link = `https://tradingview.mtsgold.co.th/mgb/history?symbol=GLD965&resolution=60&from=${from}&to=${to}`
	const response = await fetch(link);
	const { c } = await response.json();
	return c
}

async function getHSH() {
	const link = `https://apicheckprice.huasengheng.com/api/values/getprice/`
	const response = await fetch(link);
	const [{ Buy, Sell, TimeUpdate }] = await response.json();
	// console.log(Buy,Sell,TimeUpdate)
	return `ราคาปัจุบัน : ${Buy} / ${Sell}`
}

async function getTimeUnix() {
	const to = moment.tz('Asia/Bangkok');
	const from = to.clone().subtract(25, 'hours');
	const log = [{ 'Time': to.format('YYYY-MM-DD HH:mm:ss'), 'Unix': to.unix() },{ 'Time': from.format('YYYY-MM-DD HH:mm:ss'), 'Unix': from.unix() }]
	console.table(log)
	return [from.unix(), to.unix()]
}

const msgDecision = (value) => {
	// await sendTelegramMessage( `rsi: ${msgDecision(rsiLast)}   bb: ${msgDecision(pbLast)}`);
	return value < 2 ? `${value} (ระวังขึ้น)` : (value > 50 ? `${value} (ระวังลง)` : false)
}

// (async function main() {
// await getHSH()

// })()
const sendTelegramMessage = async (text) => {
	const token = process.env.TOKEN;
	const url = `https://api.telegram.org/bot${token}/sendMessage`;
	const chatId = '5105182746'

	const body = {
		chat_id: chatId,
		text: text
	};

	const { statusCode, body: resBody } = await request(url, {
		method: 'POST',
		headers: {
			'content-type': 'application/json'
		},
		body: JSON.stringify(body)
	});

	const data = await resBody.json();
	console.log('Send Message :', statusCode);
	//   console.log('Response:', data);
};

fastify.get('/test', async (request, reply) => {
	const [fromTime, toTime] = await getTimeUnix()
	const closes = await getData(fromTime, toTime);
	const inputRSI = {
		values: closes,
		period: 2
	};
	const rsi = RSI.calculate(inputRSI);
	const rsiLast = rsi.at(-2)
	console.log(inputRSI)
	// console.log(rsi);
	console.log(`RSI : ${rsiLast}`) // rsiLast < 2  or rsiLast > 99

	const inputBB = {
		period: 10,
		values: closes,
		stdDev: 2.5
	};
	const bb = BollingerBands.calculate(inputBB);
	const pbLast = parseFloat((bb.at(-2).pb * 100).toFixed(2))
	// console.table(bb);
	console.log(`BB : ${pbLast}`)
	let msg = ''
	msg = msg + (msgDecision(rsiLast) ? `RSI-2: ${msgDecision(rsiLast)}` : "")
	msg = msg + (msg.length != "" ? "\n" : "")
	msg = msg + (msgDecision(pbLast) ? `BB-2.5: ${msgDecision(pbLast)}` : "")
	console.log("--------\n", msg)
	msg.length != "" ? sendTelegramMessage(msg + "\n" + (await getHSH())) : null

	return { rsi: msgDecision(rsiLast), bb: msgDecision(pbLast) };
});

fastify.get('/msg', async (request, reply) => {
	sendTelegramMessage('ส่งข้อความผ่าน undici สำเร็จ!');
	return { message: 'Hello from /test!' };
});
fastify.get('/hsh', async (request, reply) => {
	return getHSH();
});
fastify.listen({ port: PORT, host: '0.0.0.0'} , () => {
	console.log('Server running at http://localhost:3000');
});

