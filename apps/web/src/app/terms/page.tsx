import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Use | SiteMatcher',
  description: 'Terms of Use for SiteMatcher - Please read these terms carefully before using our services.',
};

export default function TermsOfUsePage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="prose prose-lg max-w-none">
          <h1 className="text-3xl font-bold mb-8 text-center">Terms of Use</h1>
          <p className="text-gray-600 text-center mb-8">Last updated: September 03, 2025</p>
          
          <div className="space-y-6">
            <section>
              <h2 className="text-2xl font-semibold mb-4">Agreement to Our Legal Terms</h2>
              <p className="mb-4">
                We are SiteMatcher LTD, doing business as SiteMatcher ('Company', 'we', 'us', or 'our'), 
                a company registered in the United Kingdom at 124 City Road, London EC1V 2NX.
              </p>
              <p className="mb-4">
                We operate the website <a href="https://sitematcher.co.uk" className="text-blue-600 hover:underline">https://sitematcher.co.uk</a> (the 'Site'), 
                as well as any other related products and services that refer or link to these legal terms (the 'Legal Terms') 
                (collectively, the 'Services').
              </p>
              <p className="mb-4">
                SiteMatcher is a directory site where commercial occupiers and developers can list their site requirements. 
                It serves as a platform connecting property seekers with available commercial spaces.
              </p>
              <p className="mb-4">
                These Legal Terms constitute a legally binding agreement made between you, whether personally or on behalf of 
                an entity ('you'), and SiteMatcher LTD, concerning your access to and use of the Services. You agree that by 
                accessing the Services, you have read, understood, and agreed to be bound by all of these Legal Terms.
              </p>
              <div className="bg-amber-50 border-l-4 border-amber-400 p-4 mb-4">
                <p className="font-semibold">
                  IF YOU DO NOT AGREE WITH ALL OF THESE LEGAL TERMS, THEN YOU ARE EXPRESSLY PROHIBITED FROM USING THE 
                  SERVICES AND YOU MUST DISCONTINUE USE IMMEDIATELY.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">1. Our Services</h2>
              <p className="mb-4">
                The information provided when using the Services is not intended for distribution to or use by any person 
                or entity in any jurisdiction or country where such distribution or use would be contrary to law or regulation 
                or which would subject us to any registration requirement within such jurisdiction or country.
              </p>
              <p className="mb-4">
                Accordingly, those persons who choose to access the Services from other locations do so on their own 
                initiative and are solely responsible for compliance with local laws, if and to the extent local laws 
                are applicable.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">2. Intellectual Property Rights</h2>
              <h3 className="text-xl font-semibold mb-2">Our Intellectual Property</h3>
              <p className="mb-4">
                We are the owner or the licensee of all intellectual property rights in our Services, including all source 
                code, databases, functionality, software, website designs, audio, video, text, photographs, and graphics 
                in the Services (collectively, the 'Content'), as well as the trademarks, service marks, and logos 
                contained therein (the 'Marks').
              </p>
              <p className="mb-4">
                Our Content and Marks are protected by copyright and trademark laws (and various other intellectual property 
                rights and unfair competition laws) and treaties in the United States and around the world.
              </p>
              <p className="mb-4">
                The Content and Marks are provided in or through the Services 'AS IS' for your personal, non-commercial 
                use or internal business purpose only.
              </p>
              
              <h3 className="text-xl font-semibold mb-2">Your Use of Our Services</h3>
              <p className="mb-4">
                Subject to your compliance with these Legal Terms, including the 'Prohibited Activities' section below, 
                we grant you a non-exclusive, non-transferable, revocable licence to:
              </p>
              <ul className="list-disc pl-6 mb-4">
                <li>access the Services; and</li>
                <li>download or print a copy of any portion of the Content to which you have properly gained access</li>
              </ul>
              <p className="mb-4">
                solely for your personal, non-commercial use or internal business purpose.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">3. User Representations</h2>
              <p className="mb-4">
                By using the Services, you represent and warrant that:
              </p>
              <ul className="list-disc pl-6 mb-4">
                <li>All registration information you submit will be true, accurate, current, and complete</li>
                <li>You will maintain the accuracy of such information and promptly update such registration information as necessary</li>
                <li>You have the legal capacity and you agree to comply with these Legal Terms</li>
                <li>You are not a minor in the jurisdiction in which you reside</li>
                <li>You will not access the Services through automated or non-human means, whether through a bot, script, or otherwise</li>
                <li>You will not use the Services for any illegal or unauthorised purpose</li>
                <li>Your use of the Services will not violate any applicable law or regulation</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">4. User Registration</h2>
              <p className="mb-4">
                You may be required to register to use the Services. You agree to keep your password confidential and 
                will be responsible for all use of your account and password. We reserve the right to remove, reclaim, 
                or change a username you select if we determine, in our sole discretion, that such username is inappropriate, 
                obscene, or otherwise objectionable.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">5. Prohibited Activities</h2>
              <p className="mb-4">
                You may not access or use the Services for any purpose other than that for which we make the Services 
                available. The Services may not be used in connection with any commercial endeavours except those that 
                are specifically endorsed or approved by us.
              </p>
              <p className="mb-4">As a user of the Services, you agree not to:</p>
              <ul className="list-disc pl-6 mb-4">
                <li>Systematically retrieve data or other content from the Services to create or compile, directly or indirectly, 
                    a collection, compilation, database, or directory without written permission from us</li>
                <li>Trick, defraud, or mislead us and other users, especially in any attempt to learn sensitive account 
                    information such as user passwords</li>
                <li>Circumvent, disable, or otherwise interfere with security-related features of the Services</li>
                <li>Disparage, tarnish, or otherwise harm, in our opinion, us and/or the Services</li>
                <li>Use any information obtained from the Services in order to harass, abuse, or harm another person</li>
                <li>Make improper use of our support services or submit false reports of abuse or misconduct</li>
                <li>Use the Services in a manner inconsistent with any applicable laws or regulations</li>
                <li>Engage in unauthorised framing of or linking to the Services</li>
                <li>Upload or transmit (or attempt to upload or to transmit) viruses, Trojan horses, or other material</li>
                <li>Engage in any automated use of the system, such as using scripts to send comments or messages</li>
                <li>Delete the copyright or other proprietary rights notice from any Content</li>
                <li>Attempt to impersonate another user or person or use the username of another user</li>
                <li>Upload or transmit any material that acts as a passive or active information collection or transmission mechanism</li>
                <li>Interfere with, disrupt, or create an undue burden on the Services or the networks or services connected to the Services</li>
                <li>Harass, annoy, intimidate, or threaten any of our employees or agents</li>
                <li>Attempt to bypass any measures of the Services designed to prevent or restrict access to the Services</li>
                <li>Copy or adapt the Services' software, including but not limited to Flash, PHP, HTML, JavaScript, or other code</li>
                <li>Decipher, decompile, disassemble, or reverse engineer any of the software comprising or making up the Services</li>
                <li>Use, launch, develop, or distribute any automated system, including without limitation, any spider, robot, cheat utility, 
                    scraper, or offline reader that accesses the Services</li>
                <li>Use the Services as part of any effort to compete with us or otherwise use the Services for any revenue-generating 
                    endeavour or commercial enterprise</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">6. User Generated Contributions</h2>
              <p className="mb-4">
                The Services may invite you to chat, contribute to, or participate in blogs, message boards, online forums, 
                and other functionality, and may provide you with the opportunity to create, submit, post, display, transmit, 
                perform, publish, distribute, or broadcast content and materials to us or on the Services (collectively, 'Contributions').
              </p>
              <p className="mb-4">
                Contributions may be viewable by other users of the Services and through third-party websites. When you 
                create or make available any Contributions, you thereby represent and warrant that:
              </p>
              <ul className="list-disc pl-6 mb-4">
                <li>Your Contributions do not infringe, violate, or misappropriate the rights of any third party</li>
                <li>You have the necessary licences, rights, consents, and permissions to use your Contributions</li>
                <li>Your Contributions are not false, inaccurate, or misleading</li>
                <li>Your Contributions are not unsolicited or unauthorised advertising or promotional material</li>
                <li>Your Contributions are not obscene, lewd, lascivious, filthy, violent, harassing, libellous, slanderous, 
                    or otherwise objectionable</li>
                <li>Your Contributions do not ridicule, mock, disparage, intimidate, or abuse anyone</li>
                <li>Your Contributions are not used to harass or threaten any other person</li>
                <li>Your Contributions do not violate any applicable law, regulation, or rule</li>
                <li>Your Contributions do not violate the privacy or publicity rights of any third party</li>
                <li>Your Contributions do not violate any applicable law concerning child pornography</li>
                <li>Your Contributions do not include any offensive comments connected to race, national origin, gender, 
                    sexual preference, or physical handicap</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">7. Contribution Licence</h2>
              <p className="mb-4">
                By posting your Contributions to any part of the Services, you automatically grant, and you represent and 
                warrant that you have the right to grant, to us an unrestricted, unlimited, irrevocable, perpetual, 
                non-exclusive, transferable, royalty-free, fully-paid, worldwide right, and licence to host, use, copy, 
                reproduce, disclose, sell, resell, publish, broadcast, retitle, archive, store, cache, publicly perform, 
                publicly display, reformat, translate, transmit, excerpt (in whole or in part), and distribute such 
                Contributions (including, without limitation, your image and voice) for any purpose, commercial, advertising, 
                or otherwise, and to prepare derivative works of, or incorporate into other works, such Contributions, 
                and grant and authorise sublicences of the foregoing.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">8. Privacy Policy</h2>
              <p className="mb-4">
                We care about data privacy and security. Please review our Privacy Policy: 
                <a href="https://app.termly.io/policy-viewer/policy.html?policyUUID=70f2f9d5-072f-443a-944d-39630c45252c" className="text-blue-600 hover:underline"> https://app.termly.io/policy-viewer/policy.html?policyUUID=70f2f9d5-072f-443a-944d-39630c45252c</a>. 
                By using the Services, you agree to be bound by our Privacy Policy, which is incorporated into these Legal Terms.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">9. Termination</h2>
              <p className="mb-4">
                These Legal Terms shall remain in full force and effect while you use the Services. Without limiting any 
                other provision of these Legal Terms, we reserve the right to, in our sole discretion and without notice 
                or liability, deny access to and use of the Services (including blocking certain IP addresses), to any 
                person for any reason or for no reason, including without limitation for breach of any representation, 
                warranty, or covenant contained in these Legal Terms or of any applicable law or regulation.
              </p>
              <p className="mb-4">
                If we terminate or suspend your account for any reason, you are prohibited from registering and creating 
                a new account under your name, a fake or borrowed name, or the name of any third party, even if you may 
                be acting on behalf of the third party.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">10. Disclaimer</h2>
              <p className="mb-4">
                THE SERVICES ARE PROVIDED ON AN AS-IS AND AS-AVAILABLE BASIS. YOU AGREE THAT YOUR USE OF THE SERVICES 
                WILL BE AT YOUR SOLE RISK. TO THE FULLEST EXTENT PERMITTED BY LAW, WE DISCLAIM ALL WARRANTIES, EXPRESS 
                OR IMPLIED, IN CONNECTION WITH THE SERVICES AND YOUR USE THEREOF, INCLUDING, WITHOUT LIMITATION, THE 
                IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE MAKE 
                NO WARRANTIES OR REPRESENTATIONS ABOUT THE ACCURACY OR COMPLETENESS OF THE SERVICES' CONTENT OR THE 
                CONTENT OF ANY WEBSITES OR MOBILE APPLICATIONS LINKED TO THE SERVICES AND WE WILL ASSUME NO LIABILITY 
                OR RESPONSIBILITY FOR ANY (1) ERRORS, MISTAKES, OR INACCURACIES OF CONTENT AND MATERIALS, (2) PERSONAL 
                INJURY OR PROPERTY DAMAGE, OF ANY NATURE WHATSOEVER, RESULTING FROM YOUR ACCESS TO AND USE OF THE SERVICES, 
                (3) ANY UNAUTHORISED ACCESS TO OR USE OF OUR SECURE SERVERS AND/OR ANY AND ALL PERSONAL INFORMATION 
                AND/OR FINANCIAL INFORMATION STORED THEREIN, (4) ANY INTERRUPTION OR CESSATION OF TRANSMISSION TO OR 
                FROM THE SERVICES, (5) ANY BUGS, VIRUSES, TROJAN HORSES, OR THE LIKE WHICH MAY BE TRANSMITTED TO OR 
                THROUGH THE SERVICES BY ANY THIRD PARTY, AND/OR (6) ANY ERRORS OR OMISSIONS IN ANY CONTENT AND MATERIALS 
                OR FOR ANY LOSS OR DAMAGE OF ANY KIND INCURRED AS A RESULT OF THE USE OF ANY CONTENT POSTED, TRANSMITTED, 
                OR OTHERWISE MADE AVAILABLE VIA THE SERVICES.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">11. Limitations of Liability</h2>
              <p className="mb-4">
                IN NO EVENT WILL WE OR OUR DIRECTORS, EMPLOYEES, OR AGENTS BE LIABLE TO YOU OR ANY THIRD PARTY FOR ANY 
                DIRECT, INDIRECT, CONSEQUENTIAL, EXEMPLARY, INCIDENTAL, SPECIAL, OR PUNITIVE DAMAGES, INCLUDING LOST 
                PROFIT, LOST REVENUE, LOSS OF DATA, OR OTHER DAMAGES ARISING FROM YOUR USE OF THE SERVICES, EVEN IF 
                WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">12. Indemnification</h2>
              <p className="mb-4">
                You agree to defend, indemnify, and hold us harmless, including our subsidiaries, affiliates, and all 
                of our respective officers, agents, partners, and employees, from and against any loss, damage, liability, 
                claim, or demand, including reasonable attorneys' fees and expenses, made by any third party due to or 
                arising out of: (1) use of the Services; (2) breach of these Legal Terms; (3) any breach of your 
                representations and warranties set forth in these Legal Terms; (4) your violation of the rights of a 
                third party, including but not limited to intellectual property rights; or (5) any overt harmful act 
                toward any other user of the Services with whom you connected via the Services.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">13. User Data</h2>
              <p className="mb-4">
                We will maintain certain data that you transmit to the Services for the purpose of managing the performance 
                of the Services, as well as data relating to your use of the Services. Although we perform regular routine 
                backups of data, you are solely responsible for all data that you transmit or that relates to any activity 
                you have undertaken using the Services.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">14. Electronic Communications, Transactions, and Signatures</h2>
              <p className="mb-4">
                Visiting the Services, sending us emails, and completing online forms constitute electronic communications. 
                You consent to receive electronic communications, and you agree that all agreements, notices, disclosures, 
                and other communications we provide to you electronically, via email and on the Services, satisfy any 
                legal requirement that such communication be in writing.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">15. Miscellaneous</h2>
              <p className="mb-4">
                These Legal Terms and any policies or operating rules posted by us on the Services or in respect to the 
                Services constitute the entire agreement and understanding between you and us. Our failure to exercise 
                or enforce any right or provision of these Legal Terms shall not operate as a waiver of such right or provision.
              </p>
              <p className="mb-4">
                These Legal Terms operate to the fullest extent permissible by law. We may assign any or all of our 
                rights and obligations to others at any time. We shall not be responsible or liable for any loss, damage, 
                delay, or failure to act caused by any cause beyond our reasonable control.
              </p>
              <p className="mb-4">
                If any provision or part of a provision of these Legal Terms is determined to be unlawful, void, or 
                unenforceable, that provision or part of the provision is deemed severable from these Legal Terms and 
                does not affect the validity and enforceability of any remaining provisions.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">16. Contact Us</h2>
              <p className="mb-4">
                In order to resolve a complaint regarding the Services or to receive further information regarding use 
                of the Services, please contact us at:
              </p>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="font-semibold">SiteMatcher LTD</p>
                <p>124 City Road</p>
                <p>London EC1V 2NX</p>
                <p>United Kingdom</p>
                <p>Email: <a href="mailto:hello@sitematcher.co.uk" className="text-blue-600 hover:underline">hello@sitematcher.co.uk</a></p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}