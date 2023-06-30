import puppeteer from 'puppeteer';
import fs from 'fs';
import TelegramBot from 'node-telegram-bot-api';
import 'dotenv/config'

const token = process.env.TELEGRAM_TOKEN;
const bot = new TelegramBot(token, { polling: true });

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;

    (async () => {

        const browser = await puppeteer.launch({ headless: 'new' });
        const page = await browser.newPage();

        const url = "https://rastreamento.correios.com.br/core/securimage/securimage_show.php?" + Math.random();
        await page.goto(url);
        await page.screenshot({ path: 'captcha.png', clip: { x: 250, y: 250, width: 300, height: 100 } });

        bot.sendPhoto(chatId, 'captcha.png', { caption: "Digite o código do captcha:" });

        let codigoCaptcha;

        bot.on('message', async (msg) => {
            if (!codigoCaptcha) {
                // codigo do captcha
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
                        bot.sendMessage(chatId, template(json));
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

// template de mensagens
function template(json) {
    const data = json.eventos.map((evento) => {
        // xxxx-xx-xx 00:00:00.000000 -> 00/00/0000 00:00:00
        const data = evento.dtHrCriado.date.split(' ')[0].split('-').reverse().join('/');
        const hora = evento.dtHrCriado.date.split(' ')[1].split('.')[0];
        return `${data} ${hora}`;
    });

    const origem = json.eventos.map((evento) => {
        if (!evento.unidade.endereco.cidade || !evento.unidade.endereco.uf) {
            if (!evento.unidade.nome) {
                return evento.unidade.tipo;
            } else {
                return evento.unidade.nome;
            }
        }
        return evento.unidade.tipo + ' - ' + evento.unidade.endereco.cidade + '/' + evento.unidade.endereco.uf;
    });

    const status = json.eventos.map((evento) => {
        return evento.descricao;
    });

    const mensagem = data.map((data, index) => {
        return `🗓️ Data: ${data}\n🏛️ Origem: ${origem[index]}\n📫 Status: ${status[index]}`;
    })

    return mensagem.join('\n\n');
}

// debugar json
bot.onText(/\/debug/, (msg) => {
    const chatId = msg.chat.id;
    fs.readFile('resultado.json', 'utf8', function (err, data) {
        if (err) throw err;
        const json = JSON.parse(data);
        bot.sendMessage(chatId, template(json));
    });
});