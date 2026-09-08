// ===== Smooth Scroll =====
document.querySelectorAll('nav a').forEach(link => {
    link.addEventListener('click', function(e){
        e.preventDefault();

        const target = document.querySelector(this.getAttribute('href'));

        if(target){
            target.scrollIntoView({
                behavior:'smooth'
            });
        }
    });
});


// ===== Order Form =====
const form = document.querySelector("form");

if(form){

form.addEventListener("submit", function(e){

e.preventDefault();

alert(
"Thank You!\n\nYour order has been received.\nOur team will contact you on WhatsApp soon."
);

form.reset();

});

}


// ===== Service Card Animation =====
const cards = document.querySelectorAll(".card");

window.addEventListener("scroll",()=>{

cards.forEach(card=>{

const pos = card.getBoundingClientRect().top;

if(pos < window.innerHeight-100){

card.style.opacity="1";

card.style.transform="translateY(0)";

}

});

});

cards.forEach(card=>{

card.style.opacity="0";

card.style.transform="translateY(40px)";

card.style.transition="0.6s";

});


// ===== Gallery Zoom =====
document.querySelectorAll(".gallery img").forEach(img=>{

img.addEventListener("click",()=>{

img.classList.toggle("active");

});

});


// ===== Back To Top Button =====

const btn=document.createElement("button");

btn.innerHTML="⬆";

btn.id="topBtn";

document.body.appendChild(btn);

btn.style.position="fixed";
btn.style.bottom="20px";
btn.style.right="20px";
btn.style.width="50px";
btn.style.height="50px";
btn.style.borderRadius="50%";
btn.style.border="none";
btn.style.background="#ff0000";
btn.style.color="#fff";
btn.style.fontSize="22px";
btn.style.cursor="pointer";
btn.style.display="none";
btn.style.boxShadow="0 5px 10px rgba(0,0,0,.3)";

window.addEventListener("scroll",()=>{

if(window.scrollY>300){

btn.style.display="block";

}else{

btn.style.display="none";

}

});

btn.onclick=function(){

window.scrollTo({

top:0,

behavior:"smooth"

});

};


// ===== Welcome Message =====
window.onload=function(){

console.log("Welcome to Saya Art & Advertising");

};