import puppeteer from 'puppeteer';
import fs from 'fs';
import TelegramBot from 'node-telegram-bot-api';
import 'dotenv/config'

const token = process.env.TELEGRAM_TOKEN;
const rastreio = process.env.COD_RASTREIO;
const bot = new TelegramBot(token, { polling: true });

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;

    (async () => {
        const url = "https://rastreamento.correios.com.br/core/securimage/securimage_show.php?" + Math.random();

        const browser = await puppeteer.launch({ headless: false });
        const page = await browser.newPage();
        await page.goto(url);
        // // screenshot do captcha centralizado
        await page.screenshot({ path: 'captcha.png', clip: { x: 250, y: 250, width: 300, height: 100 } });

        bot.sendPhoto(chatId, 'captcha.png', { caption: "Digite o código do captcha:" });
        bot.on('message', async (msg) => {
            // obter o código do captcha digitado pelo usuário
            const codigoCaptcha = msg.text;
            const chatId = msg.chat.id;

            await page.goto("https://rastreamento.correios.com.br/app/resultado.php?objeto=" + rastreio + "&captcha=" + codigoCaptcha + "&mqs=S");
            // imprimir json com o resultado da busca
            const json = await page.evaluate(() => {
                return JSON.parse(document.querySelector("body").innerText);
            });

            const eventos = json.eventos.map((evento) => {
                return evento.descricao;
            });

            const data = json.eventos.map((evento) => {
                return evento.dtHrCriado.date;
            });

            const template = eventos.map((evento, index) => {
                return `${data[index]} - ${evento}`;
            });

            bot.sendMessage(chatId, template.join('\n'));
            // salvar json em arquivo
            fs.writeFile("resultado.json", JSON.stringify(json), function (err) {
                if (err) {
                    return console.log(err);
                } else {
                    console.log("Arquivo salvo com sucesso!");
                }
            });
            // apagar imagem do captcha
            fs.unlink('captcha.png', (err) => {
                if (err) throw err;
                console.log('Arquivo deletado com sucesso!');
            });
            await browser.close();
        });
    })();
});