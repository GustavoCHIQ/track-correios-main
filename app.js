import puppeteer from 'puppeteer';
import fs from 'fs';
import TelegramBot from 'node-telegram-bot-api';
import 'dotenv/config'

const token = process.env.TELEGRAM_TOKEN;
const bot = new TelegramBot(token, { polling: true });

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;

    (async () => {

        const browser = await puppeteer.launch({ headless: false });
        const page = await browser.newPage();

        const url = "https://rastreamento.correios.com.br/core/securimage/securimage_show.php?" + Math.random();
        await page.goto(url);
        await page.screenshot({ path: 'captcha.png', clip: { x: 250, y: 250, width: 300, height: 100 } });

        bot.sendPhoto(chatId, 'captcha.png', { caption: "Digite o código do captcha:" });

        let codigoCaptcha;

        bot.on('message', async (msg) => {
            if (!codigoCaptcha) {
                codigoCaptcha = msg.text;
                if (codigoCaptcha) {
                    bot.sendMessage(chatId, "Digite o código de rastreio:");
                } else {
                    bot.sendMessage(chatId, "Digite o código do captcha:");
                }
            } else {
                // codigo de rastreio
                const rastreio = msg.text;
                if (rastreio) {
                    await page.goto("https://rastreamento.correios.com.br/app/resultado.php?objeto=" + rastreio + "&captcha=" + codigoCaptcha + "&mqs=S");

                    const json = await page.evaluate(() => {
                        return JSON.parse(document.querySelector("body").innerText);
                    });

                    if (!json.eventos) {
                        bot.sendMessage(chatId, "Erro ao consultar o código de rastreio, tente novamente!");
                    } else {
                        const eventos = json.eventos.map((evento) => {
                            return evento.descricao;
                        });

                        const data = json.eventos.map((evento) => {
                            // 2023-06-26 21:03:22.000000 -> 26/06/2023 21:03:22
                            const data = evento.dtHrCriado.date.split(' ')[0].split('-').reverse().join('/');
                            const hora = evento.dtHrCriado.date.split(' ')[1].split('.')[0];
                            return `${data} ${hora}`;
                        });

                        const template = eventos.map((evento, index) => {
                            return `${data[index]} - ${evento}`;
                        });

                        bot.sendMessage(chatId, template.join('\n'));


                        try {
                            salvarArquivo(json);
                            apagarArquivo();
                            await browser.close();
                        } catch (err) {
                            console.log(err);
                        }
                    }
                } else {
                    bot.sendMessage(chatId, "Digite o código de rastreio:");
                }
            }
        });
    })();
});

function apagarArquivo() {
    fs.unlink('captcha.png', (err) => {
        if (err) throw err;
        console.log('Arquivo deletado com sucesso!');
    });
}

function salvarArquivo(json) {
    fs.writeFile("resultado.json", JSON.stringify(json), function (err) {
        if (err) {
            return console.log(err);
        } else {
            console.log("Arquivo salvo com sucesso!");
        }
    });
}